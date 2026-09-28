package com.lms.service;

import com.lms.dto.FocusDtos;
import com.lms.model.Alert;
import com.lms.model.ChatMessage;
import com.lms.model.ClassroomSession;
import com.lms.model.Course;
import com.lms.model.User;
import com.lms.repository.AlertRepository;
import com.lms.repository.ChatMessageRepository;
import com.lms.repository.ClassroomSessionRepository;
import com.lms.repository.CourseRepository;
import com.lms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomSessionRepository sessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final AlertRepository alertRepository;
    private final MonitoringService monitoringService;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    public List<ClassroomSession> getActiveSessions() {
        return sessionRepository.findByIsActiveTrue();
    }

    public List<ClassroomSession> getSessionsByCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        return sessionRepository.findByCourse(course);
    }

    public ClassroomSession getSessionById(Long id) {
        return sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
    }

    @Transactional
    public ClassroomSession createSession(String title, Long courseId, String teacherEmail) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        ClassroomSession session = ClassroomSession.builder()
                .title(title)
                .course(course)
                .hostTeacher(teacher)
                .isActive(true)
                .startTime(LocalDateTime.now())
                .build();
        return sessionRepository.save(session);
    }

    @Transactional
    public ClassroomSession endSession(Long sessionId) {
        ClassroomSession session = getSessionById(sessionId);
        session.setIsActive(false);
        session.setEndTime(LocalDateTime.now());
        return sessionRepository.save(session);
    }

    @Transactional
    public ChatMessage saveChatMessage(Long sessionId, String senderEmail, String content) {
        ClassroomSession session = getSessionById(sessionId);
        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        ChatMessage message = ChatMessage.builder()
                .session(session)
                .sender(sender)
                .content(content)
                .build();
        ChatMessage saved = chatMessageRepository.save(message);

        // Push to everyone watching this room so chat is live, not poll-based.
        messagingTemplate.convertAndSend("/topic/chat/" + sessionId, Map.of(
                "id", saved.getId(),
                "senderId", sender.getId(),
                "sender", sender.getFullName(),
                "role", sender.getRole().name().toLowerCase(Locale.ENGLISH),
                "content", saved.getContent(),
                "time", saved.getTimestamp().format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH))
        ));
        return saved;
    }

    public List<ChatMessage> getChatHistory(Long sessionId) {
        ClassroomSession session = getSessionById(sessionId);
        return chatMessageRepository.findBySessionOrderByTimestampAsc(session);
    }

    // ───────────────────────────── focus enforcement ─────────────────────────

    /** Strikes before a student is removed from the room. */
    private static final int OFF_TASK_LIMIT = 3;

    /**
     * Records that a student left the class window or stopped sharing, and
     * decides what the platform does about it.
     * <p>
     * The count lives on the server so a client that simply declines to report
     * further events cannot wind it back. What we cannot do is identify the
     * application they switched to, or close it — the browser exposes neither.
     * Enforcement is therefore: block our own room, tell the teacher, and
     * ultimately remove the student.
     */
    @Transactional
    public FocusDtos.FocusEventResponse recordFocusEvent(Long sessionId, User student,
                                                         FocusDtos.FocusEventRequest request) {
        ClassroomSession session = getSessionById(sessionId);
        FocusDtos.EventType type = request.getType();

        if (type == FocusDtos.EventType.RETURNED) {
            long priorCount = countOffTaskAlerts(session, student);
            return FocusDtos.FocusEventResponse.builder()
                    .violations((int) priorCount)
                    .limit(OFF_TASK_LIMIT)
                    .action(FocusDtos.Enforcement.NONE)
                    .removed(priorCount >= OFF_TASK_LIMIT)
                    .message("Welcome back.")
                    .build();
        }

        boolean shareStopped = type == FocusDtos.EventType.SCREEN_SHARE_STOPPED;
        Alert.AlertType alertType = shareStopped
                ? Alert.AlertType.SCREEN_SHARE_STOPPED
                : Alert.AlertType.OFF_TASK;

        long violations = countOffTaskAlerts(session, student) + 1;

        FocusDtos.Enforcement action;
        String message;
        Alert.Severity severity;

        if (violations >= OFF_TASK_LIMIT) {
            action = FocusDtos.Enforcement.REMOVED;
            severity = Alert.Severity.CRITICAL;
            message = "You have been removed from this class after " + violations
                    + " off-task events. Speak to your teacher to rejoin.";
        } else if (violations == OFF_TASK_LIMIT - 1) {
            action = FocusDtos.Enforcement.FINAL_WARNING;
            severity = Alert.Severity.HIGH;
            message = "Final warning: leaving the class again will remove you from the session.";
        } else {
            action = FocusDtos.Enforcement.WARN;
            severity = Alert.Severity.MEDIUM;
            message = shareStopped
                    ? "Screen sharing stopped. Resume sharing to continue in this class."
                    : "Return to the class window. This has been recorded and your teacher notified.";
        }

        String detail = shareStopped
                ? student.getFullName() + " stopped sharing their screen during the class."
                : student.getFullName() + " left the class window"
                + (request.getAwaySeconds() != null ? " for " + request.getAwaySeconds() + "s." : ".");

        monitoringService.raiseClassroomAlert(student, session.getId(), alertType, severity,
                detail + " (" + violations + "/" + OFF_TASK_LIMIT + ")");

        return FocusDtos.FocusEventResponse.builder()
                .violations((int) violations)
                .limit(OFF_TASK_LIMIT)
                .action(action)
                .removed(action == FocusDtos.Enforcement.REMOVED)
                .message(message)
                .build();
    }

    /** Focus alerts raised in this session, newest first. */
    private List<Alert> focusAlerts(ClassroomSession session) {
        return alertRepository.findBySessionIdAndContextTypeOrderByTimestampDesc(session.getId(), "CLASSROOM")
                .stream()
                .filter(a -> a.getAlertType() == Alert.AlertType.OFF_TASK
                        || a.getAlertType() == Alert.AlertType.SCREEN_SHARE_STOPPED)
                .toList();
    }

    /**
     * Strikes that still count against a student. Alerts a teacher has forgiven
     * are excluded, which is what makes readmission possible without deleting
     * the record of what happened.
     */
    private long countOffTaskAlerts(ClassroomSession session, User student) {
        return focusAlerts(session).stream()
                .filter(a -> a.getStudent().getId().equals(student.getId()))
                .filter(a -> !Boolean.TRUE.equals(a.getResolved()))
                .count();
    }

    /** True once the student has used up their focus allowance for this session. */
    public boolean isRemovedFromSession(Long sessionId, User student) {
        return countOffTaskAlerts(getSessionById(sessionId), student) >= OFF_TASK_LIMIT;
    }

    // ──────────────────────────── teacher controls ───────────────────────────

    /** Every student who has picked up a focus strike in this session. */
    @Transactional(readOnly = true)
    public List<FocusDtos.StudentStanding> focusStandings(Long sessionId, User caller) {
        ClassroomSession session = getSessionById(sessionId);
        requireHost(session, caller);

        Map<Long, List<Alert>> byStudent = focusAlerts(session).stream()
                .collect(Collectors.groupingBy(a -> a.getStudent().getId()));

        return byStudent.values().stream().map(alerts -> {
            User student = alerts.get(0).getStudent();
            long active = alerts.stream().filter(a -> !Boolean.TRUE.equals(a.getResolved())).count();
            long forgiven = alerts.size() - active;
            Alert latest = alerts.get(0); // repository returns newest first

            return FocusDtos.StudentStanding.builder()
                    .studentId(student.getId())
                    .studentName(student.getFullName())
                    .studentEmail(student.getEmail())
                    .avatar(student.getAvatarEmoji() != null ? student.getAvatarEmoji() : "🎓")
                    .violations((int) active)
                    .limit(OFF_TASK_LIMIT)
                    .removed(active >= OFF_TASK_LIMIT)
                    .lastEvent(latest.getAlertType().name())
                    .lastEventAt(latest.getTimestamp() != null
                            ? latest.getTimestamp().format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH))
                            : null)
                    .forgiven((int) forgiven)
                    .build();
        }).sorted(Comparator
                .comparing(FocusDtos.StudentStanding::getRemoved).reversed()
                .thenComparing(FocusDtos.StudentStanding::getViolations, Comparator.reverseOrder()))
                .toList();
    }

    /**
     * Clears a student's outstanding strikes so they can rejoin, and tells their
     * browser immediately over the session topic. The alerts are marked resolved
     * rather than deleted.
     */
    @Transactional
    public FocusDtos.StudentStanding readmitStudent(Long sessionId, Long studentId, User caller) {
        ClassroomSession session = getSessionById(sessionId);
        requireHost(session, caller);

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + studentId));

        List<Alert> outstanding = focusAlerts(session).stream()
                .filter(a -> a.getStudent().getId().equals(studentId))
                .filter(a -> !Boolean.TRUE.equals(a.getResolved()))
                .toList();

        if (outstanding.isEmpty()) {
            throw new IllegalArgumentException(student.getFullName() + " has no strikes to clear.");
        }

        outstanding.forEach(alert -> {
            alert.setResolved(true);
            alert.setResolvedAt(LocalDateTime.now());
            alert.setResolvedBy(caller);
        });
        alertRepository.saveAll(outstanding);

        // The student's open tab clears its block without a refresh.
        messagingTemplate.convertAndSend("/topic/classroom/" + sessionId, Map.of(
                "type", "READMITTED",
                "studentId", studentId,
                "by", caller.getFullName(),
                "message", "Your teacher has readmitted you to the class."
        ));

        notificationService.push(student,
                "Readmitted to class",
                caller.getFullName() + " has readmitted you to " + session.getTitle() + ".",
                "success");

        return FocusDtos.StudentStanding.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .studentEmail(student.getEmail())
                .avatar(student.getAvatarEmoji() != null ? student.getAvatarEmoji() : "🎓")
                .violations(0)
                .limit(OFF_TASK_LIMIT)
                .removed(false)
                .forgiven(outstanding.size())
                .build();
    }

    /** Only the teacher hosting the session — or an admin — may act on it. */
    private void requireHost(ClassroomSession session, User caller) {
        if (caller.getRole() == User.Role.ADMIN) return;
        if (caller.getRole() != User.Role.TEACHER
                || session.getHostTeacher() == null
                || !session.getHostTeacher().getId().equals(caller.getId())) {
            throw new IllegalArgumentException("Only the teacher hosting this class can do that.");
        }
    }
}
