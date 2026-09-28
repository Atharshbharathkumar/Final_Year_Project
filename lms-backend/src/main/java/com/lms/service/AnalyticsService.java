package com.lms.service;

import com.lms.dto.AnalyticsDtos;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The single source of truth for every derived figure in the platform.
 * <p>
 * Nothing here is invented: each score is a documented function of rows that
 * exist in the database (attendance, submissions, attention logs, alerts, exam
 * attempts). Feeding new rows in changes the dashboards immediately.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsService {

    /** Weights of the composite engagement score; they sum to 1.0. */
    private static final double W_ATTENDANCE = 0.30;
    private static final double W_ASSIGNMENTS = 0.25;
    private static final double W_ATTENTION = 0.25;
    private static final double W_QUIZ = 0.20;

    /** Each alert raised against a student costs 3 points, capped at 15. */
    private static final int ALERT_PENALTY_PER_ALERT = 3;
    private static final int ALERT_PENALTY_CAP = 15;

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final DepartmentRepository departmentRepository;
    private final ClassroomSessionRepository sessionRepository;

    // ────────────────────────────── component scores ──────────────────────────

    /** Share of held sessions the student was marked present for. */
    public OptionalInt attendanceRate(User student) {
        List<AttendanceRecord> records = attendanceRepository.findByStudent(student);
        if (records.isEmpty()) return OptionalInt.empty();
        long present = records.stream().filter(r -> Boolean.TRUE.equals(r.getPresent())).count();
        return OptionalInt.of((int) Math.round(100.0 * present / records.size()));
    }

    /** Share of the student's assigned work that has been submitted or graded. */
    public OptionalInt assignmentCompletion(User student) {
        List<Assignment> assigned = assignmentsFor(student);
        if (assigned.isEmpty()) return OptionalInt.empty();

        Map<Long, Submission> byAssignment = submissionRepository.findByStudent(student).stream()
                .collect(Collectors.toMap(s -> s.getAssignment().getId(), s -> s, (a, b) -> a));

        long done = assigned.stream()
                .map(a -> byAssignment.get(a.getId()))
                .filter(Objects::nonNull)
                .filter(s -> s.getStatus() == Submission.Status.SUBMITTED || s.getStatus() == Submission.Status.GRADED)
                .count();
        return OptionalInt.of((int) Math.round(100.0 * done / assigned.size()));
    }

    /** Mean of every attention score the vision pipeline has logged. */
    public OptionalInt meanAttention(User student) {
        List<AttentionLog> logs = attentionLogRepository.findByStudent(student);
        OptionalDouble mean = logs.stream()
                .filter(l -> l.getScore() != null)
                .mapToDouble(AttentionLog::getScore)
                .average();
        return mean.isPresent() ? OptionalInt.of((int) Math.round(mean.getAsDouble())) : OptionalInt.empty();
    }

    /** Mean percentage across every submitted exam attempt. */
    public OptionalInt quizPerformance(User student) {
        List<ExamAttempt> attempts = attemptRepository.findByStudent(student).stream()
                .filter(a -> a.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS)
                .filter(a -> a.getMaxScore() != null && a.getMaxScore() > 0)
                .toList();
        if (attempts.isEmpty()) return OptionalInt.empty();
        double mean = attempts.stream()
                .mapToDouble(a -> 100.0 * (a.getScore() == null ? 0 : a.getScore()) / a.getMaxScore())
                .average()
                .orElse(0);
        return OptionalInt.of((int) Math.round(mean));
    }

    /**
     * Live-class participation: chat contributions and completed work, scaled so
     * an active student in a seeded cohort lands in the 70-95 band.
     */
    public int participation(User student) {
        long chats = chatMessageRepository.countBySender(student);
        long submitted = submissionRepository.findByStudent(student).stream()
                .filter(s -> s.getStatus() == Submission.Status.SUBMITTED || s.getStatus() == Submission.Status.GRADED)
                .count();
        return clamp((int) Math.round(chats * 12 + submitted * 8.0));
    }

    public int alertPenalty(User student) {
        int alerts = alertRepository.findByStudentOrderByTimestampDesc(student).size();
        return Math.min(ALERT_PENALTY_CAP, alerts * ALERT_PENALTY_PER_ALERT);
    }

    /**
     * Composite engagement score. Components with no data are dropped and the
     * remaining weights are renormalised, so a brand-new student is not punished
     * for an empty history.
     */
    public int engagementScore(User student) {
        double weighted = 0;
        double weightUsed = 0;

        OptionalInt att = attendanceRate(student);
        if (att.isPresent()) { weighted += att.getAsInt() * W_ATTENDANCE; weightUsed += W_ATTENDANCE; }

        OptionalInt asg = assignmentCompletion(student);
        if (asg.isPresent()) { weighted += asg.getAsInt() * W_ASSIGNMENTS; weightUsed += W_ASSIGNMENTS; }

        OptionalInt vis = meanAttention(student);
        if (vis.isPresent()) { weighted += vis.getAsInt() * W_ATTENTION; weightUsed += W_ATTENTION; }

        OptionalInt quiz = quizPerformance(student);
        if (quiz.isPresent()) { weighted += quiz.getAsInt() * W_QUIZ; weightUsed += W_QUIZ; }

        if (weightUsed == 0) return 0;
        return clamp((int) Math.round(weighted / weightUsed) - alertPenalty(student));
    }

    /** Academic standing on a 4.0 scale, from graded coursework and exams. */
    public double gpa(User student) {
        List<Double> percentages = new ArrayList<>();

        submissionRepository.findByStudent(student).stream()
                .filter(s -> s.getStatus() == Submission.Status.GRADED && s.getGrade() != null)
                .filter(s -> s.getAssignment().getPoints() != null && s.getAssignment().getPoints() > 0)
                .forEach(s -> percentages.add(100.0 * s.getGrade() / s.getAssignment().getPoints()));

        attemptRepository.findByStudent(student).stream()
                .filter(a -> a.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS)
                .filter(a -> a.getMaxScore() != null && a.getMaxScore() > 0)
                .forEach(a -> percentages.add(100.0 * (a.getScore() == null ? 0 : a.getScore()) / a.getMaxScore()));

        if (percentages.isEmpty()) return 0.0;
        double mean = percentages.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        return Math.round(Math.max(0, Math.min(4.0, mean / 100.0 * 4.0)) * 100.0) / 100.0;
    }

    /** low / medium / high, from engagement and attendance together. */
    public String riskLevel(User student) {
        int engagement = engagementScore(student);
        int attendance = attendanceRate(student).orElse(100);
        if (engagement < 60 || attendance < 75) return "high";
        if (engagement < 75 || attendance < 85) return "medium";
        return "low";
    }

    public String letterGrade(int percentage) {
        if (percentage >= 90) return "A+";
        if (percentage >= 85) return "A";
        if (percentage >= 80) return "A-";
        if (percentage >= 75) return "B+";
        if (percentage >= 70) return "B";
        if (percentage >= 65) return "B-";
        if (percentage >= 60) return "C+";
        if (percentage >= 50) return "C";
        return "D";
    }

    // ─────────────────────────────── per-course ───────────────────────────────

    /**
     * Course progress blends syllabus coverage (sessions actually held against
     * the planned total) with how much of that course's work this student has
     * completed.
     */
    public int courseProgress(User student, Course course) {
        int planned = course.getTotalSessions() == null || course.getTotalSessions() == 0 ? 30 : course.getTotalSessions();
        long held = attendanceRepository.findByCourse(course).stream()
                .map(AttendanceRecord::getSessionDate)
                .distinct()
                .count();
        int coverage = clamp((int) Math.round(100.0 * held / planned));

        List<Assignment> courseWork = assignmentRepository.findByCourse(course);
        int completion;
        if (courseWork.isEmpty()) {
            completion = coverage;
        } else {
            Set<Long> doneIds = submissionRepository.findByStudent(student).stream()
                    .filter(s -> s.getStatus() == Submission.Status.SUBMITTED || s.getStatus() == Submission.Status.GRADED)
                    .map(s -> s.getAssignment().getId())
                    .collect(Collectors.toSet());
            long done = courseWork.stream().filter(a -> doneIds.contains(a.getId())).count();
            completion = (int) Math.round(100.0 * done / courseWork.size());
        }
        return clamp((int) Math.round(0.5 * coverage + 0.5 * completion));
    }

    /** Mean graded percentage for one course, used for the course letter grade. */
    public int courseScorePercent(User student, Course course) {
        List<Double> pct = submissionRepository.findByStudent(student).stream()
                .filter(s -> s.getAssignment().getCourse().getId().equals(course.getId()))
                .filter(s -> s.getStatus() == Submission.Status.GRADED && s.getGrade() != null)
                .filter(s -> s.getAssignment().getPoints() != null && s.getAssignment().getPoints() > 0)
                .map(s -> 100.0 * s.getGrade() / s.getAssignment().getPoints())
                .toList();
        if (pct.isEmpty()) return quizPerformance(student).orElse(engagementScore(student));
        return clamp((int) Math.round(pct.stream().mapToDouble(Double::doubleValue).average().orElse(0)));
    }

    // ─────────────────────────────── collections ──────────────────────────────

    public List<Course> coursesFor(User student) {
        return enrollmentRepository.findByStudent(student).stream()
                .map(Enrollment::getCourse)
                .toList();
    }

    public List<Assignment> assignmentsFor(User student) {
        List<Course> courses = coursesFor(student);
        if (courses.isEmpty()) return List.of();
        return assignmentRepository.findByCourseInOrderByDueDateAsc(courses);
    }

    /** Every student a teacher can see: enrolled in any course they own. */
    public List<User> studentsOf(User teacher) {
        List<Course> owned = courseRepository.findByTeacher(teacher);
        if (owned.isEmpty()) return List.of();
        return owned.stream()
                .flatMap(c -> enrollmentRepository.findByCourse(c).stream())
                .map(Enrollment::getStudent)
                .distinct()
                .sorted(Comparator.comparing(User::getFullName))
                .toList();
    }

    public List<AnalyticsDtos.RosterEntry> roster(List<User> students) {
        return students.stream().map(this::rosterEntry).toList();
    }

    public AnalyticsDtos.RosterEntry rosterEntry(User student) {
        String risk = riskLevel(student);
        return AnalyticsDtos.RosterEntry.builder()
                .id(student.getId())
                .name(student.getFullName())
                .email(student.getEmail())
                .department(student.getDepartment() != null ? student.getDepartment().getCode() : "—")
                .year(student.getStudyYear())
                .gpa(gpa(student))
                .engagement(engagementScore(student))
                .attendance(attendanceRate(student).orElse(0))
                .status("high".equals(risk) ? "at-risk" : "active")
                .avatar(student.getAvatarEmoji() != null ? student.getAvatarEmoji() : "🎓")
                .risk(risk)
                .build();
    }

    // ──────────────────────────────── trends ──────────────────────────────────

    /**
     * Seven-day rolling trend. Each day aggregates the attention logs, attendance
     * rows and chat activity actually recorded on that date.
     */
    public List<AnalyticsDtos.TrendPoint> weeklyTrend(List<User> students) {
        Set<Long> ids = students.stream().map(User::getId).collect(Collectors.toSet());
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(6);

        List<AttentionLog> logs = attentionLogRepository
                .findByTimestampBetween(from.atStartOfDay(), today.plusDays(1).atStartOfDay()).stream()
                .filter(l -> ids.isEmpty() || ids.contains(l.getStudent().getId()))
                .toList();

        List<AttendanceRecord> attendance = attendanceRepository.findAll().stream()
                .filter(r -> r.getSessionDate() != null)
                .filter(r -> !r.getSessionDate().isBefore(from) && !r.getSessionDate().isAfter(today))
                .filter(r -> ids.isEmpty() || ids.contains(r.getStudent().getId()))
                .toList();

        List<ChatMessage> chats = chatMessageRepository.findAll().stream()
                .filter(m -> m.getTimestamp() != null)
                .filter(m -> !m.getTimestamp().toLocalDate().isBefore(from))
                .toList();

        List<AnalyticsDtos.TrendPoint> points = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate day = from.plusDays(i);

            OptionalDouble dayEngagement = logs.stream()
                    .filter(l -> l.getTimestamp() != null && l.getTimestamp().toLocalDate().equals(day))
                    .filter(l -> l.getScore() != null)
                    .mapToDouble(AttentionLog::getScore)
                    .average();

            List<AttendanceRecord> dayAttendance = attendance.stream()
                    .filter(r -> r.getSessionDate().equals(day))
                    .toList();
            int attendancePct = dayAttendance.isEmpty() ? -1
                    : (int) Math.round(100.0 * dayAttendance.stream()
                    .filter(r -> Boolean.TRUE.equals(r.getPresent())).count() / dayAttendance.size());

            long dayChats = chats.stream().filter(m -> m.getTimestamp().toLocalDate().equals(day)).count();
            int participationPct = students.isEmpty() ? 0
                    : clamp((int) Math.round(100.0 * dayChats / Math.max(1, students.size()) * 1.5));

            points.add(AnalyticsDtos.TrendPoint.builder()
                    .day(day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .engagement(dayEngagement.isPresent() ? (int) Math.round(dayEngagement.getAsDouble()) : null)
                    .attendance(attendancePct < 0 ? null : attendancePct)
                    .participation(participationPct)
                    .build());
        }

        // Carry the last known reading across days with no session, so the chart
        // stays continuous instead of collapsing to zero at the weekend.
        Integer lastEngagement = null;
        Integer lastAttendance = null;
        for (AnalyticsDtos.TrendPoint p : points) {
            if (p.getEngagement() == null) p.setEngagement(lastEngagement == null ? 0 : lastEngagement);
            else lastEngagement = p.getEngagement();
            if (p.getAttendance() == null) p.setAttendance(lastAttendance == null ? 0 : lastAttendance);
            else lastAttendance = p.getAttendance();
        }
        return points;
    }

    /** Twelve-month growth series built from user, attention and attendance history. */
    public List<AnalyticsDtos.MonthlyPoint> monthlyTrend() {
        LocalDate today = LocalDate.now();
        List<User> allStudents = userRepository.findByRole(User.Role.STUDENT);
        List<AttentionLog> allLogs = attentionLogRepository.findAll();
        List<AttendanceRecord> allAttendance = attendanceRepository.findAll();

        List<AnalyticsDtos.MonthlyPoint> series = new ArrayList<>();
        for (int i = 7; i >= 0; i--) {
            LocalDate monthStart = today.minusMonths(i).withDayOfMonth(1);
            LocalDate monthEnd = monthStart.plusMonths(1);

            long enrolledByThen = allStudents.stream()
                    .filter(u -> u.getCreatedAt() != null && u.getCreatedAt().toLocalDate().isBefore(monthEnd))
                    .count();

            OptionalDouble engagement = allLogs.stream()
                    .filter(l -> l.getTimestamp() != null)
                    .filter(l -> !l.getTimestamp().toLocalDate().isBefore(monthStart)
                            && l.getTimestamp().toLocalDate().isBefore(monthEnd))
                    .filter(l -> l.getScore() != null)
                    .mapToDouble(AttentionLog::getScore)
                    .average();

            List<AttendanceRecord> monthAttendance = allAttendance.stream()
                    .filter(r -> r.getSessionDate() != null)
                    .filter(r -> !r.getSessionDate().isBefore(monthStart) && r.getSessionDate().isBefore(monthEnd))
                    .toList();

            series.add(AnalyticsDtos.MonthlyPoint.builder()
                    .month(monthStart.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .students(enrolledByThen)
                    .engagement(engagement.isPresent() ? (int) Math.round(engagement.getAsDouble()) : 0)
                    .attendance(monthAttendance.isEmpty() ? 0 : (int) Math.round(100.0 * monthAttendance.stream()
                            .filter(r -> Boolean.TRUE.equals(r.getPresent())).count() / monthAttendance.size()))
                    .build());
        }
        return series;
    }

    public List<AnalyticsDtos.DepartmentStats> departmentStats() {
        return departmentRepository.findAll().stream().map(dept -> {
            List<User> students = userRepository.findByRoleAndDepartment(User.Role.STUDENT, dept);
            List<User> teachers = userRepository.findByRoleAndDepartment(User.Role.TEACHER, dept);
            long courses = teachers.stream().mapToLong(t -> courseRepository.findByTeacher(t).size()).sum();
            int avg = students.isEmpty() ? 0
                    : (int) Math.round(students.stream().mapToInt(this::engagementScore).average().orElse(0));
            return AnalyticsDtos.DepartmentStats.builder()
                    .name(dept.getName())
                    .code(dept.getCode())
                    .students((long) students.size())
                    .teachers((long) teachers.size())
                    .courses(courses)
                    .avgEngagement(avg)
                    .build();
        }).sorted(Comparator.comparing(AnalyticsDtos.DepartmentStats::getStudents).reversed()).toList();
    }

    /** Platform-wide mean engagement across every student on record. */
    public int platformEngagement() {
        List<User> students = userRepository.findByRole(User.Role.STUDENT);
        if (students.isEmpty()) return 0;
        return (int) Math.round(students.stream().mapToInt(this::engagementScore).average().orElse(0));
    }

    public int platformAttendance() {
        List<AttendanceRecord> all = attendanceRepository.findAll();
        if (all.isEmpty()) return 0;
        return (int) Math.round(100.0 * all.stream()
                .filter(r -> Boolean.TRUE.equals(r.getPresent())).count() / all.size());
    }

    public long activeSessionCount() {
        return sessionRepository.countByIsActiveTrue();
    }

    /** Percentage-point change in engagement between this week and the previous one. */
    public double weekOverWeekChange(User student) {
        LocalDateTime now = LocalDateTime.now();
        double thisWeek = meanScoreBetween(student, now.minusDays(7), now);
        double lastWeek = meanScoreBetween(student, now.minusDays(14), now.minusDays(7));
        if (lastWeek == 0) return 0;
        return Math.round((thisWeek - lastWeek) * 10.0) / 10.0;
    }

    private double meanScoreBetween(User student, LocalDateTime from, LocalDateTime to) {
        return attentionLogRepository.findByStudentAndTimestampBetween(student, from, to).stream()
                .filter(l -> l.getScore() != null)
                .mapToDouble(AttentionLog::getScore)
                .average().orElse(0);
    }

    public static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    /** Monday-first label used by the weekly chart. */
    public static String dayLabel(DayOfWeek day) {
        return day.getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
    }
}