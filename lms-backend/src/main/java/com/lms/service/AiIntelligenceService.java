package com.lms.service;

import com.lms.model.*;
import com.lms.repository.*;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiIntelligenceService {

    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final ExamAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final AnalyticsService analytics;
    private final AcademicService academic;
    private final AlseService alse;

    /**
     * Risk prediction for one student, blending the exponentially smoothed
     * attention series with alert volume and coursework signals.
     */
    public StudentAiAnalysis predictStudentRisk(Long studentId) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null) {
            return StudentAiAnalysis.builder()
                    .studentName("Unknown")
                    .overallEngagementScore(0.0)
                    .confusionIndex(0.0)
                    .riskLevel("UNKNOWN")
                    .recommendation("No record found for this student id.")
                    .build();
        }

        List<AttentionLog> logs = attentionLogRepository.findByStudentOrderByTimestampAsc(student);
        List<Alert> alerts = alertRepository.findByStudentOrderByTimestampDesc(student);

        // Exponential moving average over the measured attention series.
        double alpha = 0.3;
        double ema = logs.isEmpty() ? analytics.engagementScore(student) : 90.0;
        int lowAttentionCount = 0;
        for (AttentionLog log : logs) {
            if (log.getScore() == null) continue;
            ema = alpha * log.getScore() + (1 - alpha) * ema;
            if (log.getScore() < 50.0) lowAttentionCount++;
        }

        double engagement = analytics.engagementScore(student);
        double confusionIndex = Math.min(100.0, Math.max(0.0,
                (100.0 - engagement) * 0.9 + alerts.size() * 4.0));

        String risk = analytics.riskLevel(student).toUpperCase(Locale.ENGLISH);
        String recommendation = switch (risk) {
            case "HIGH" -> "High risk of disengagement: schedule a 1-on-1 review session and re-teach the weakest module.";
            case "MEDIUM" -> "Moderate fluctuation: launch a quick interactive poll or short break to re-engage.";
            default -> "Maintain current momentum — engagement is healthy across all measured signals.";
        };

        return StudentAiAnalysis.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .overallEngagementScore(round(ema))
                .currentEngagementScore(engagement)
                .confusionIndex(round(confusionIndex))
                .alertCount(alerts.size())
                .lowAttentionFrequency(lowAttentionCount)
                .attendanceRate(analytics.attendanceRate(student).orElse(0))
                .assignmentCompletion(analytics.assignmentCompletion(student).orElse(0))
                .riskLevel(risk)
                .recommendation(recommendation)
                .build();
    }

    /** Weighted integrity model over proctoring telemetry for one attempt. */
    public ExamIntegrityAnalysis evaluateExamIntegrity(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null) {
            return ExamIntegrityAnalysis.builder()
                    .integrityConfidenceScore(0.0)
                    .status("ATTEMPT_NOT_FOUND")
                    .flaggedAnomalies(List.of("No attempt found for this id."))
                    .build();
        }

        int tabSwitches = attempt.getTabSwitchCount() != null ? attempt.getTabSwitchCount() : 0;
        double avgAttention = attempt.getAverageAttentionScore() != null ? attempt.getAverageAttentionScore() : 90.0;

        long proctorAlerts = alertRepository.findByStudentOrderByTimestampDesc(attempt.getStudent()).stream()
                .filter(a -> "EXAM".equals(a.getContextType()))
                .filter(a -> attempt.getId().equals(a.getSessionId()))
                .count();

        double penalty = (tabSwitches * 25.0)
                + Math.max(0, (80.0 - avgAttention) * 1.5)
                + proctorAlerts * 5.0;
        double confidence = Math.max(0.0, Math.min(100.0, 100.0 - penalty));

        List<String> flags = new ArrayList<>();
        if (tabSwitches > 0) flags.add("Detected " + tabSwitches + " browser tab focus switches.");
        if (avgAttention < 60) flags.add("Average gaze attention dropped below threshold (score: " + Math.round(avgAttention) + "%).");
        if (proctorAlerts > 0) flags.add(proctorAlerts + " proctoring alert(s) raised during this attempt.");
        if (flags.isEmpty()) flags.add("No violations registered.");

        String status;
        if (confidence < 50.0) status = "FLAGGED_HIGH_CHEATING_RISK";
        else if (confidence < 80.0) status = "MODERATE_REVIEW_RECOMMENDED";
        else status = "VERIFIED_HIGH_INTEGRITY";

        return ExamIntegrityAnalysis.builder()
                .attemptId(attempt.getId())
                .studentName(attempt.getStudent().getFullName())
                .integrityConfidenceScore(round(confidence))
                .status(status)
                .tabSwitches(tabSwitches)
                .averageAttentionScore(round(avgAttention))
                .flaggedAnomalies(flags)
                .build();
    }

    /**
     * Study assistant. Answers are composed from this student's own record —
     * enrolled courses, due work, measured engagement and learning state — rather
     * than from a canned script.
     */
    public CopilotAnswer askAiCopilot(User student, String question) {
        if (question == null || question.isBlank()) {
            return new CopilotAnswer("Ask me about your deadlines, courses, grades, attendance or study plan.", List.of());
        }
        String q = question.toLowerCase(Locale.ENGLISH);

        if (contains(q, "due", "deadline", "assignment", "submit", "pending")) {
            return dueWorkAnswer(student);
        }
        if (contains(q, "grade", "score", "gpa", "mark", "result")) {
            return gradesAnswer(student);
        }
        if (contains(q, "attendance", "absent", "present")) {
            return attendanceAnswer(student);
        }
        if (contains(q, "engagement", "focus", "attention", "state", "distract")) {
            return engagementAnswer(student);
        }
        if (contains(q, "course", "subject", "enrolled", "syllabus")) {
            return coursesAnswer(student);
        }
        if (contains(q, "exam", "test", "quiz")) {
            return examsAnswer(student);
        }
        if (contains(q, "plan", "study", "schedule", "prepare", "revise")) {
            return studyPlanAnswer(student);
        }
        if (contains(q, "credit", "achievement", "workshop")) {
            int credits = academic.totalCredits(student);
            return new CopilotAnswer(
                    "You have banked **" + credits + " of 60** academic credits so far. "
                            + (credits >= 60 ? "You have met the honours threshold."
                            : "You need " + (60 - credits) + " more to reach the honours threshold."),
                    List.of("What events can earn me credits?", "Show my study plan"));
        }
        return overviewAnswer(student);
    }

    private CopilotAnswer dueWorkAnswer(User student) {
        List<com.lms.dto.AcademicDtos.AssignmentCard> open = academic.assignmentsForStudent(student).stream()
                .filter(a -> "pending".equals(a.getStatus()) || "in-progress".equals(a.getStatus()))
                .sorted(Comparator.comparing(a -> a.getDueDate() == null ? "9999" : a.getDueDate()))
                .toList();

        if (open.isEmpty()) {
            return new CopilotAnswer("You are all caught up — nothing is pending right now.",
                    List.of("Show my grades", "How is my attendance?"));
        }

        StringBuilder sb = new StringBuilder("You have **" + open.size() + "** item(s) outstanding:\n");
        open.stream().limit(5).forEach(a -> sb.append("• ")
                .append(a.getTitle())
                .append(" — ").append(a.getCourse())
                .append(" (due ").append(a.getDueDate()).append(", ").append(a.getPoints()).append(" pts)\n"));

        var next = open.get(0);
        sb.append("\nStart with **").append(next.getTitle()).append("** — it is due first.");
        return new CopilotAnswer(sb.toString(), List.of("Show my study plan", "How am I performing?"));
    }

    private CopilotAnswer gradesAnswer(User student) {
        double gpa = analytics.gpa(student);
        int quiz = analytics.quizPerformance(student).orElse(0);
        Course best = analytics.coursesFor(student).stream()
                .max(Comparator.comparingInt(c -> analytics.courseScorePercent(student, c))).orElse(null);
        Course worst = analytics.coursesFor(student).stream()
                .min(Comparator.comparingInt(c -> analytics.courseScorePercent(student, c))).orElse(null);

        StringBuilder sb = new StringBuilder("Your GPA is **" + gpa + " / 4.0**");
        if (quiz > 0) sb.append(", with a mean assessment score of ").append(quiz).append("%");
        sb.append(".\n");
        if (best != null) {
            sb.append("Strongest: **").append(best.getTitle()).append("** (")
                    .append(analytics.courseScorePercent(student, best)).append("%).\n");
        }
        if (worst != null && best != null && !worst.getId().equals(best.getId())) {
            sb.append("Needs attention: **").append(worst.getTitle()).append("** (")
                    .append(analytics.courseScorePercent(student, worst)).append("%).");
        }
        return new CopilotAnswer(sb.toString(), List.of("What is due next?", "Build me a study plan"));
    }

    private CopilotAnswer attendanceAnswer(User student) {
        int rate = analytics.attendanceRate(student).orElse(0);
        String verdict = rate >= 90 ? "Excellent." : rate >= 75 ? "Acceptable, but keep it up." : "Below the usual 75% requirement.";
        return new CopilotAnswer("Your attendance stands at **" + rate + "%**. " + verdict,
                List.of("How is my engagement?", "What is due next?"));
    }

    private CopilotAnswer engagementAnswer(User student) {
        int engagement = analytics.engagementScore(student);
        var state = alse.currentState(student);
        double change = analytics.weekOverWeekChange(student);

        String trend = change > 0 ? "up " + change + " points on last week"
                : change < 0 ? "down " + Math.abs(change) + " points on last week"
                : "level with last week";

        return new CopilotAnswer(
                "Your engagement score is **" + engagement + "/100** (" + trend + ").\n"
                        + "The engine currently reads your learning state as **" + state.getState()
                        + "** at " + state.getConfidence() + "% confidence. " + state.getDescription(),
                List.of("How do I improve my score?", "What is due next?"));
    }

    private CopilotAnswer coursesAnswer(User student) {
        var courses = academic.coursesForStudent(student);
        if (courses.isEmpty()) {
            return new CopilotAnswer("You are not enrolled in any courses yet.", List.of());
        }
        StringBuilder sb = new StringBuilder("You are enrolled in **" + courses.size() + "** courses:\n");
        courses.forEach(c -> sb.append("• ").append(c.getName())
                .append(" (").append(c.getCode()).append(") — ")
                .append(c.getProgress()).append("% complete, grade ").append(c.getGrade()).append('\n'));
        return new CopilotAnswer(sb.toString(), List.of("Which course needs the most work?", "What is due next?"));
    }

    private CopilotAnswer examsAnswer(User student) {
        var exams = academic.examsForStudent(student);
        var upcoming = exams.stream().filter(e -> "upcoming".equals(e.getStatus())).toList();
        if (upcoming.isEmpty()) {
            return new CopilotAnswer("No upcoming exams are scheduled for your courses.",
                    List.of("Show my grades", "What is due next?"));
        }
        StringBuilder sb = new StringBuilder("You have **" + upcoming.size() + "** upcoming assessment(s):\n");
        upcoming.forEach(e -> sb.append("• ").append(e.getTitle())
                .append(" — ").append(e.getCourse())
                .append(" on ").append(e.getDate()).append(" at ").append(e.getTime()).append('\n'));
        return new CopilotAnswer(sb.toString(), List.of("Build me a study plan", "Show my grades"));
    }

    private CopilotAnswer studyPlanAnswer(User student) {
        var open = academic.assignmentsForStudent(student).stream()
                .filter(a -> "pending".equals(a.getStatus()) || "in-progress".equals(a.getStatus()))
                .sorted(Comparator.comparing(a -> a.getDueDate() == null ? "9999" : a.getDueDate()))
                .toList();
        Course weakest = analytics.coursesFor(student).stream()
                .min(Comparator.comparingInt(c -> analytics.courseScorePercent(student, c))).orElse(null);
        String peak = alse.digitalTwin(student).getCharacteristics().getPeakLearning();

        StringBuilder sb = new StringBuilder("Here is a plan based on your record:\n");
        sb.append("1. Your measured peak focus window is **").append(peak).append("** — schedule deep work there.\n");
        if (weakest != null) {
            sb.append("2. Give **").append(weakest.getTitle()).append("** the most time; it is your lowest scoring course at ")
                    .append(analytics.courseScorePercent(student, weakest)).append("%.\n");
        }
        if (!open.isEmpty()) {
            sb.append("3. Clear **").append(open.get(0).getTitle()).append("** first — due ")
                    .append(open.get(0).getDueDate()).append(".\n");
        }
        int attendance = analytics.attendanceRate(student).orElse(0);
        if (attendance < 85) {
            sb.append("4. Attendance is ").append(attendance).append("% — attending every session is the fastest single lift to your score.");
        } else {
            sb.append("4. Keep attendance where it is (").append(attendance).append("%) — it is currently protecting your score.");
        }
        return new CopilotAnswer(sb.toString(), List.of("What is due next?", "How is my engagement?"));
    }

    private CopilotAnswer overviewAnswer(User student) {
        int engagement = analytics.engagementScore(student);
        long open = academic.assignmentsForStudent(student).stream()
                .filter(a -> "pending".equals(a.getStatus()) || "in-progress".equals(a.getStatus()))
                .count();
        return new CopilotAnswer(
                "Here is where you stand: engagement **" + engagement + "/100**, attendance **"
                        + analytics.attendanceRate(student).orElse(0) + "%**, GPA **" + analytics.gpa(student)
                        + "**, with **" + open + "** item(s) of work outstanding.\n"
                        + "Ask me about deadlines, grades, attendance, engagement or a study plan.",
                List.of("What is due next?", "Show my grades", "Build me a study plan"));
    }

    private boolean contains(String haystack, String... needles) {
        for (String n : needles) {
            if (haystack.contains(n)) return true;
        }
        return false;
    }

    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    /** Minutes of measured activity for a student in the last 24 hours. */
    public long activeMinutesToday(User student) {
        LocalDateTime since = LocalDateTime.now().minusDays(1);
        List<AttentionLog> logs = attentionLogRepository.findByStudentAndTimestampBetween(student, since, LocalDateTime.now());
        if (logs.size() < 2) return logs.size();
        return Duration.between(logs.get(0).getTimestamp(), logs.get(logs.size() - 1).getTimestamp()).toMinutes();
    }

    @Data
    @Builder
    public static class StudentAiAnalysis {
        private Long studentId;
        private String studentName;
        private Double overallEngagementScore;
        private Double currentEngagementScore;
        private Double confusionIndex;
        private Integer alertCount;
        private Integer lowAttentionFrequency;
        private Integer attendanceRate;
        private Integer assignmentCompletion;
        private String riskLevel;
        private String recommendation;
    }

    @Data
    @Builder
    public static class ExamIntegrityAnalysis {
        private Long attemptId;
        private String studentName;
        private Double integrityConfidenceScore;
        private String status;
        private Integer tabSwitches;
        private Double averageAttentionScore;
        private List<String> flaggedAnomalies;
    }

    /** Assistant reply plus the follow-up chips the UI renders under it. */
    public record CopilotAnswer(String answer, List<String> suggestions) {
    }
}