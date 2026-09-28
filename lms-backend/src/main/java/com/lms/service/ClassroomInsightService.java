package com.lms.service;

import com.lms.dto.AnalyticsDtos;
import com.lms.dto.ClassroomDtos;
import com.lms.dto.DashboardDtos;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds the live-classroom participant grid and the automated post-session
 * report from the attention logs and alerts recorded against a session.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassroomInsightService {

    private static final DateTimeFormatter REPORT_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    private static final String DISCLAIMER =
            "EduVerse AI assists educators with evidence and insights. It does not replace human judgment. "
                    + "Camera and screen analysis require explicit user consent.";

    private final ClassroomSessionRepository sessionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;

    /** The running session, or the most recent one if nothing is live. */
    public Optional<ClassroomSession> currentSession() {
        return sessionRepository.findFirstByIsActiveTrueOrderByStartTimeDesc()
                .or(() -> sessionRepository.findAll().stream()
                        .max(Comparator.comparing(ClassroomSession::getStartTime)));
    }

    public ClassroomDtos.LiveClassroom liveClassroom(Long sessionId) {
        ClassroomSession session = sessionId != null
                ? sessionRepository.findById(sessionId).orElse(currentSession().orElse(null))
                : currentSession().orElse(null);

        if (session == null) {
            return ClassroomDtos.LiveClassroom.builder()
                    .classInfo(ClassroomDtos.ClassInfo.builder()
                            .title("No session scheduled").subject("—").topic("—")
                            .teacher("—").duration("00:00").attendees(0).total(0).active(false)
                            .build())
                    .participants(List.of())
                    .screenActivity(ClassroomDtos.ScreenActivity.builder()
                            .courseRelated(0).otherActivity(0).tabSwitching(0).build())
                    .analysis(ClassroomDtos.LiveAnalysis.builder()
                            .overallFocus(0).participation(0).participationLabel("—")
                            .faceVerified(0).attentionShifts(0).awayFromFrame(0)
                            .avgFocusMinutes(0).sessionMinutes(0).build())
                    .build();
        }

        List<User> enrolled = enrollmentRepository.findByCourse(session.getCourse()).stream()
                .map(Enrollment::getStudent)
                .sorted(Comparator.comparing(User::getFullName))
                .toList();

        List<AttentionLog> logs = attentionLogRepository
                .findBySessionIdAndContextTypeOrderByTimestampAsc(session.getId(), "CLASSROOM");

        // Newest reading per student is what the grid renders.
        Map<Long, AttentionLog> latestByStudent = logs.stream().collect(Collectors.toMap(
                l -> l.getStudent().getId(), l -> l,
                (a, b) -> a.getTimestamp().isAfter(b.getTimestamp()) ? a : b));

        List<ClassroomDtos.Participant> participants = enrolled.stream()
                .map(student -> toParticipant(student, latestByStudent.get(student.getId())))
                .toList();

        long present = participants.stream().filter(p -> !"not-detected".equals(p.getStatus())).count();
        long verified = participants.stream().filter(p -> Boolean.TRUE.equals(p.getVerified())).count();
        long shifts = participants.stream().filter(p -> "attention-shift".equals(p.getStatus())).count();
        long away = participants.stream().filter(p -> "away".equals(p.getStatus())).count();

        int overallFocus = (int) Math.round(logs.stream()
                .filter(l -> l.getScore() != null)
                .mapToDouble(AttentionLog::getScore)
                .average().orElse(0));

        long onTask = logs.stream().filter(l -> !Boolean.FALSE.equals(l.getIsTabActive())).count();
        int courseRelated = logs.isEmpty() ? 0 : (int) Math.round(100.0 * onTask / logs.size());
        int tabSwitching = logs.isEmpty() ? 0 : (int) Math.round(100.0 * (logs.size() - onTask) / logs.size());

        LocalDateTime end = session.getEndTime() != null ? session.getEndTime() : LocalDateTime.now();
        Duration elapsed = Duration.between(session.getStartTime(), end);
        int sessionMinutes = (int) Math.max(1, elapsed.toMinutes());

        long chats = chatMessageRepository.findBySessionOrderByTimestampAsc(session).size();
        int participation = enrolled.isEmpty() ? 0
                : AnalyticsService.clamp((int) Math.round(100.0 * chats / enrolled.size() * 1.5));

        return ClassroomDtos.LiveClassroom.builder()
                .classInfo(ClassroomDtos.ClassInfo.builder()
                        .sessionId(session.getId())
                        .title(session.getTitle())
                        .subject(session.getCourse().getTitle())
                        .courseCode(session.getCourse().getCourseCode())
                        .topic(session.getTitle())
                        .teacher(session.getHostTeacher().getFullName())
                        .duration(String.format("%02d:%02d", elapsed.toHours(), elapsed.toMinutesPart()))
                        .attendees((int) present)
                        .total(enrolled.size())
                        .active(Boolean.TRUE.equals(session.getIsActive()))
                        .build())
                .participants(participants)
                .screenActivity(ClassroomDtos.ScreenActivity.builder()
                        .courseRelated(courseRelated)
                        .otherActivity(Math.max(0, 100 - courseRelated - tabSwitching))
                        .tabSwitching(tabSwitching)
                        .build())
                .analysis(ClassroomDtos.LiveAnalysis.builder()
                        .overallFocus(overallFocus)
                        .participation(participation)
                        .participationLabel(participation >= 75 ? "High" : participation >= 45 ? "Moderate" : "Low")
                        .faceVerified((int) verified)
                        .attentionShifts((int) shifts)
                        .awayFromFrame((int) away)
                        .avgFocusMinutes((int) Math.round(sessionMinutes * overallFocus / 100.0))
                        .sessionMinutes(sessionMinutes)
                        .build())
                .build();
    }

    private ClassroomDtos.Participant toParticipant(User student, AttentionLog log) {
        if (log == null) {
            return ClassroomDtos.Participant.builder()
                    .id(student.getId()).name(student.getFullName())
                    .status("not-detected").faceDetected(false)
                    .gazeDirection("N/A").headPose("N/A").expression("N/A")
                    .verified(false).attentionScore(0)
                    .build();
        }

        double score = log.getScore() == null ? 0 : log.getScore();
        String eye = log.getEyeStatus() == null ? "CENTER" : log.getEyeStatus();
        boolean faceDetected = !Boolean.FALSE.equals(log.getFaceDetected());

        String status;
        if (!faceDetected || "NO_FACE".equals(eye)) status = "away";
        else if ("LOOKING_AWAY".equals(eye) || "EYES_CLOSED".equals(eye) || score < 60) status = "attention-shift";
        else if (score >= 85) status = "focused";
        else status = "active";

        String gaze = switch (eye) {
            case "LOOKING_AWAY" -> "away";
            case "LOOKING_DOWN" -> "notes";
            case "EYES_CLOSED" -> "closed";
            case "NO_FACE" -> "N/A";
            default -> "screen";
        };

        String pose = switch (eye) {
            case "LOOKING_AWAY" -> "tilted";
            case "LOOKING_DOWN" -> "down";
            case "NO_FACE" -> "N/A";
            default -> "forward";
        };

        String expression;
        if (!faceDetected) expression = "N/A";
        else if (score >= 85) expression = "engaged";
        else if (score >= 70) expression = "neutral";
        else expression = "distracted";

        return ClassroomDtos.Participant.builder()
                .id(student.getId())
                .name(student.getFullName())
                .status(status)
                .faceDetected(faceDetected)
                .gazeDirection(gaze)
                .headPose(pose)
                .expression(expression)
                .verified(faceDetected && (log.getFaceCount() == null || log.getFaceCount() == 1))
                .attentionScore((int) Math.round(score))
                .build();
    }

    /**
     * Automated post-session report. Insight lines are generated from the counts
     * actually observed, so they change with the data.
     */
    public AnalyticsDtos.SessionReport sessionReport(Long sessionId) {
        ClassroomSession session = sessionId != null
                ? sessionRepository.findById(sessionId).orElse(currentSession().orElse(null))
                : currentSession().orElse(null);

        if (session == null) {
            return AnalyticsDtos.SessionReport.builder()
                    .sessionTitle("No sessions recorded")
                    .insights(List.of())
                    .disclaimer(DISCLAIMER)
                    .build();
        }

        ClassroomDtos.LiveClassroom live = liveClassroom(session.getId());
        List<AttentionLog> logs = attentionLogRepository
                .findBySessionIdAndContextTypeOrderByTimestampAsc(session.getId(), "CLASSROOM");
        List<Alert> alerts = alertRepository
                .findBySessionIdAndContextTypeOrderByTimestampDesc(session.getId(), "CLASSROOM");

        int total = Math.max(1, live.getClassInfo().getTotal());
        int attendees = live.getClassInfo().getAttendees();
        int overall = live.getAnalysis().getOverallFocus();

        long fullSession = logs.stream()
                .collect(Collectors.groupingBy(l -> l.getStudent().getId(), Collectors.counting()))
                .values().stream().filter(c -> c >= 3).count();

        long shiftStudents = alerts.stream()
                .filter(a -> a.getAlertType() == Alert.AlertType.LOOKING_AWAY)
                .map(a -> a.getStudent().getId()).distinct().count();
        long frameExits = alerts.stream()
                .filter(a -> a.getAlertType() == Alert.AlertType.NO_FACE)
                .map(a -> a.getStudent().getId()).distinct().count();
        long tabSwitchers = alerts.stream()
                .filter(a -> a.getAlertType() == Alert.AlertType.TAB_SWITCH)
                .map(a -> a.getStudent().getId()).distinct().count();

        long gazeOnScreen = logs.stream()
                .filter(l -> l.getEyeStatus() == null || "CENTER".equals(l.getEyeStatus()))
                .count();
        int gazePct = logs.isEmpty() ? 0 : (int) Math.round(100.0 * gazeOnScreen / logs.size());

        List<DashboardDtos.Insight> insights = new ArrayList<>();
        insights.add(insight(Math.round(100f * attendees / total) + "% of students attended the complete session",
                attendees >= total * 0.8 ? "positive" : "warning"));
        insights.add(insight(Math.round(100f * fullSession / total) + "% showed consistent participation throughout",
                fullSession >= total * 0.7 ? "positive" : "warning"));
        insights.add(insight(live.getScreenActivity().getCourseRelated() + "% maintained course-related screen activity",
                live.getScreenActivity().getCourseRelated() >= 80 ? "positive" : "warning"));
        if (shiftStudents > 0) {
            insights.add(insight(shiftStudents + " student(s) showed repeated attention shifts", "warning"));
        }
        if (frameExits > 0) {
            insights.add(insight(frameExits + " student(s) left the camera frame during the session", "warning"));
        }
        if (tabSwitchers > 0) {
            insights.add(insight(tabSwitchers + " student(s) switched away from the class tab", "warning"));
        }
        insights.add(insight("Average gaze-on-screen duration: " + gazePct + "% of session", "neutral"));

        int classAverage = (int) Math.round(userRepository.findByRole(User.Role.STUDENT).stream()
                .flatMap(s -> attentionLogRepository.findByStudent(s).stream())
                .filter(l -> l.getScore() != null)
                .mapToDouble(AttentionLog::getScore)
                .average().orElse(0));

        return AnalyticsDtos.SessionReport.builder()
                .sessionId(session.getId())
                .sessionTitle(session.getTitle())
                .courseName(session.getCourse().getTitle())
                .courseCode(session.getCourse().getCourseCode())
                .teacherName(session.getHostTeacher().getFullName())
                .date(session.getStartTime().format(REPORT_DATE))
                .attendees(attendees)
                .totalStudents(total)
                .overallEngagement(overall)
                .classAverage(classAverage)
                .avgFocusMinutes(live.getAnalysis().getAvgFocusMinutes())
                .sessionMinutes(live.getAnalysis().getSessionMinutes())
                .screenCourseRelated(live.getScreenActivity().getCourseRelated())
                .insights(insights)
                .disclaimer(DISCLAIMER)
                .build();
    }

    private DashboardDtos.Insight insight(String text, String type) {
        return DashboardDtos.Insight.builder().text(text).type(type).build();
    }

    public List<ClassroomDtos.ChatEntry> chat(ClassroomSession session) {
        return chatMessageRepository.findBySessionOrderByTimestampAsc(session).stream()
                .map(m -> ClassroomDtos.ChatEntry.builder()
                        .id(m.getId())
                        .senderId(m.getSender().getId())
                        .sender(m.getSender().getFullName())
                        .role(m.getSender().getRole().name().toLowerCase(Locale.ENGLISH))
                        .content(m.getContent())
                        .time(m.getTimestamp() != null
                                ? m.getTimestamp().format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH)) : "")
                        .build())
                .toList();
    }
}