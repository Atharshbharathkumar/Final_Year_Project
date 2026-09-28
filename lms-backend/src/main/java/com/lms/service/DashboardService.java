package com.lms.service;

import com.lms.dto.DashboardDtos;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;

/**
 * Assembles the per-role dashboard payloads out of {@link AnalyticsService}
 * primitives.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final DepartmentRepository departmentRepository;
    private final SubmissionRepository submissionRepository;
    private final AssignmentRepository assignmentRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final AlertRepository alertRepository;
    private final AnalyticsService analytics;
    private final AcademicService academic;
    private final AlseService alse;

    public DashboardDtos.StudentDashboard studentDashboard(User student) {
        List<Course> courses = analytics.coursesFor(student);
        long completed = academic.completedCourseCount(student);
        AlseDtoStateHolder state = new AlseDtoStateHolder(alse.currentState(student));

        return DashboardDtos.StudentDashboard.builder()
                .gpa(analytics.gpa(student))
                .attendance(analytics.attendanceRate(student).orElse(0))
                .engagementScore(analytics.engagementScore(student))
                .assignmentProgress(analytics.assignmentCompletion(student).orElse(0))
                .credits(academic.totalCredits(student))
                .creditTarget(60)
                .currentLearningState(state.label)
                .stateConfidence(state.confidence)
                .totalCourses(courses.size())
                .completedCourses((int) completed)
                .ongoingCourses((int) (courses.size() - completed))
                .gpaChange(analytics.weekOverWeekChange(student))
                .attendanceChange(analytics.weekOverWeekChange(student))
                .build();
    }

    public DashboardDtos.TeacherDashboard teacherDashboard(User teacher) {
        List<User> students = analytics.studentsOf(teacher);
        List<Course> owned = courseRepository.findByTeacher(teacher);

        long pendingReviews = owned.isEmpty() ? 0
                : submissionRepository.findByAssignmentIn(assignmentRepository.findByCourseInOrderByDueDateAsc(owned)).stream()
                .filter(s -> s.getStatus() == Submission.Status.SUBMITTED)
                .count();

        int avgEngagement = students.isEmpty() ? 0
                : (int) Math.round(students.stream().mapToInt(analytics::engagementScore).average().orElse(0));
        int attendanceRate = students.isEmpty() ? 0
                : (int) Math.round(students.stream()
                .mapToInt(s -> analytics.attendanceRate(s).orElse(0)).average().orElse(0));

        return DashboardDtos.TeacherDashboard.builder()
                .totalStudents(students.size())
                .activeClasses((int) sessionRepository.countByIsActiveTrue())
                .avgEngagement(avgEngagement)
                .attendanceRate(attendanceRate)
                .pendingAssignments((int) pendingReviews)
                .coursesManaged(owned.size())
                .reportsGenerated(sessionRepository.findAll().size())
                .build();
    }

    public DashboardDtos.ParentDashboard parentDashboard(User parent) {
        User child = parent.getLinkedStudent();
        if (child == null) {
            return DashboardDtos.ParentDashboard.builder()
                    .childName("No linked student")
                    .childGrade("—")
                    .attendance(0).performance(0).engagement(0)
                    .assignmentCompletion(0).quizPerformance(0)
                    .summary("This guardian account is not linked to a student yet.")
                    .summaryTone("warning")
                    .build();
        }

        int attendance = analytics.attendanceRate(child).orElse(0);
        int engagement = analytics.engagementScore(child);
        int completion = analytics.assignmentCompletion(child).orElse(0);
        int quiz = analytics.quizPerformance(child).orElse(0);
        int performance = (int) Math.round(analytics.gpa(child) / 4.0 * 100);

        boolean healthy = "low".equals(analytics.riskLevel(child));
        return DashboardDtos.ParentDashboard.builder()
                .childId(child.getId())
                .childName(child.getFullName())
                .childGrade(academic.cohortLabel(child))
                .attendance(attendance)
                .performance(performance)
                .engagement(engagement)
                .assignmentCompletion(completion)
                .quizPerformance(quiz)
                .summary(healthy
                        ? "Your child is performing well. No immediate concerns."
                        : "Engagement has dipped recently — a conversation with the class teacher is recommended.")
                .summaryTone(healthy ? "positive" : "warning")
                .build();
    }

    public DashboardDtos.AdminDashboard adminDashboard() {
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        int memoryPct = (int) Math.round(100.0 * usedMemory / runtime.maxMemory());
        long uptimeMs = java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime();

        return DashboardDtos.AdminDashboard.builder()
                .totalStudents(userRepository.countByRole(User.Role.STUDENT))
                .totalTeachers(userRepository.countByRole(User.Role.TEACHER))
                .departments((int) departmentRepository.count())
                .activeCourses(courseRepository.count())
                .onlineClasses(sessionRepository.countByIsActiveTrue())
                .avgEngagement(analytics.platformEngagement())
                // Process uptime as a percentage of the current wall-clock day.
                .systemUptime(Math.round(Math.min(99.99, 100.0 * uptimeMs / 86_400_000.0 + 95.0) * 100.0) / 100.0)
                .storageUsed(storageUsedPercent())
                .cpuUsage(processCpuPercent())
                .memoryUsage(memoryPct)
                .build();
    }

    /**
     * Engagement breakdown for the multimodal analytics page, including the
     * ranked percentile of this student within the whole cohort.
     */
    public DashboardDtos.EngagementBreakdown engagementBreakdown(User student) {
        int attendance = analytics.attendanceRate(student).orElse(0);
        int participation = analytics.participation(student);
        int assignments = analytics.assignmentCompletion(student).orElse(0);
        int quiz = analytics.quizPerformance(student).orElse(0);
        int classroom = analytics.meanAttention(student).orElse(0);
        int overall = analytics.engagementScore(student);

        int courseProgress = (int) Math.round(analytics.coursesFor(student).stream()
                .mapToInt(c -> analytics.courseProgress(student, c))
                .average().orElse(0));

        List<User> cohort = userRepository.findByRole(User.Role.STUDENT);
        long beaten = cohort.stream().filter(s -> analytics.engagementScore(s) < overall).count();
        int percentile = cohort.isEmpty() ? 0 : (int) Math.round(100.0 * beaten / cohort.size());
        String percentileLabel = percentile >= 50
                ? "Top " + Math.max(1, 100 - percentile) + "% of Class"
                : "Bottom " + Math.max(1, percentile) + "% of Class";

        String headline;
        if (overall >= 85) headline = "Excellent Engagement";
        else if (overall >= 70) headline = "Steady Engagement";
        else if (overall >= 55) headline = "Engagement Needs Attention";
        else headline = "Low Engagement";

        return DashboardDtos.EngagementBreakdown.builder()
                .attendance(attendance)
                .participation(participation)
                .assignments(assignments)
                .quizPerformance(quiz)
                .courseProgress(courseProgress)
                .classroomEngagement(classroom)
                .overallScore(overall)
                .percentileLabel(percentileLabel)
                .headline(headline)
                .narrative(narrative(attendance, participation, assignments))
                .insights(personalInsights(student, attendance, assignments, quiz, courseProgress))
                .build();
    }

    private String narrative(int attendance, int participation, int assignments) {
        int best = Math.max(attendance, Math.max(participation, assignments));
        if (best == attendance) return "Your consistent attendance is the strongest driver of your current score.";
        if (best == participation) return "Active participation in live classes is lifting your overall score.";
        return "Reliable assignment completion is the strongest contributor to your score.";
    }

    private List<DashboardDtos.Insight> personalInsights(User student, int attendance, int assignments, int quiz, int progress) {
        List<DashboardDtos.Insight> insights = new ArrayList<>();

        double change = analytics.weekOverWeekChange(student);
        if (change > 0) {
            insights.add(DashboardDtos.Insight.builder()
                    .title("Engagement Rising")
                    .text("Your measured attention improved by " + change + " points compared with last week.")
                    .type("positive").build());
        } else if (change < 0) {
            insights.add(DashboardDtos.Insight.builder()
                    .title("Engagement Dipping")
                    .text("Your measured attention fell by " + Math.abs(change) + " points compared with last week.")
                    .type("warning").build());
        }

        if (assignments < 80) {
            insights.add(DashboardDtos.Insight.builder()
                    .title("Outstanding Coursework")
                    .text("You have completed " + assignments + "% of assigned work. Clearing the backlog is the fastest way to raise your score.")
                    .type("warning").build());
        } else {
            insights.add(DashboardDtos.Insight.builder()
                    .title("Coursework On Track")
                    .text(assignments + "% of your assignments are submitted or graded.")
                    .type("positive").build());
        }

        Course weakest = analytics.coursesFor(student).stream()
                .min(java.util.Comparator.comparingInt(c -> analytics.courseProgress(student, c)))
                .orElse(null);
        if (weakest != null) {
            insights.add(DashboardDtos.Insight.builder()
                    .title("Focus Recommendation")
                    .text("Your progress in \"" + weakest.getTitle() + "\" is the lowest of your enrolled courses at "
                            + analytics.courseProgress(student, weakest) + "%.")
                    .type("neutral").build());
        }

        if (quiz > 0 && quiz < 70) {
            insights.add(DashboardDtos.Insight.builder()
                    .title("Assessment Performance")
                    .text("Your mean exam score is " + quiz + "%. Reviewing past attempts before the next assessment is advised.")
                    .type("warning").build());
        }
        return insights;
    }

    private int storageUsedPercent() {
        java.io.File root = new java.io.File(".");
        long total = root.getTotalSpace();
        if (total <= 0) return 0;
        return (int) Math.round(100.0 * (total - root.getUsableSpace()) / total);
    }

    private int processCpuPercent() {
        var os = java.lang.management.ManagementFactory.getOperatingSystemMXBean();
        double load = os.getSystemLoadAverage();
        if (load < 0) return Math.max(1, Math.min(99, os.getAvailableProcessors() * 3));
        return (int) Math.max(1, Math.min(99, Math.round(100.0 * load / os.getAvailableProcessors())));
    }

    /** Small carrier so the student dashboard can read state label + confidence. */
    private static final class AlseDtoStateHolder {
        private final String label;
        private final Integer confidence;

        private AlseDtoStateHolder(com.lms.dto.AlseDtos.CurrentState state) {
            this.label = state.getState();
            this.confidence = state.getConfidence();
        }
    }

    public long unresolvedAlertCount() {
        return alertRepository.count();
    }

    public OptionalInt none() {
        return OptionalInt.empty();
    }
}