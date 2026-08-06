package com.lms.service;

import com.lms.model.Alert;
import com.lms.model.AttentionLog;
import com.lms.model.ExamAttempt;
import com.lms.model.User;
import com.lms.repository.AlertRepository;
import com.lms.repository.AttentionLogRepository;
import com.lms.repository.ExamAttemptRepository;
import com.lms.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AiIntelligenceService {

    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final ExamAttemptRepository attemptRepository;
    private final UserRepository userRepository;

    /**
     * Engagement trend for a student, as an exponential moving average over their
     * recorded attention samples plus an alert count.
     *
     * This is descriptive statistics over measured telemetry, not a trained model
     * and not anomaly detection. The thresholds below are fixed rules chosen by
     * us, not learned — anyone asking "what was it trained on?" should be told
     * plainly that nothing was: the value is in the measurement pipeline feeding
     * it, which is real.
     */
    public StudentAiAnalysis predictStudentRisk(Long studentId) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null) {
            return StudentAiAnalysis.builder()
                    .studentName("Unknown")
                    .overallEngagementScore(null)
                    .confusionIndex(null)
                    .riskLevel("UNKNOWN")
                    .recommendation("No such student.")
                    .build();
        }

        List<AttentionLog> logs = attentionLogRepository.findByStudent(student);
        List<Alert> alerts = alertRepository.findByStudentOrderByTimestampDesc(student);

        double alpha = 0.3; // Smoothing factor
        int lowAttentionCount = 0;
        Double emaScoreOrNull = null;

        for (AttentionLog log : logs) {
            if (log.getScore() != null) {
                // Seed the average with the first real sample rather than an
                // assumed 90, which previously made a student with no data at
                // all look highly engaged.
                emaScoreOrNull = (emaScoreOrNull == null)
                        ? log.getScore()
                        : alpha * log.getScore() + (1 - alpha) * emaScoreOrNull;
                if (log.getScore() < 50.0) lowAttentionCount++;
            }
        }

        if (emaScoreOrNull == null) {
            return StudentAiAnalysis.builder()
                    .studentId(student.getId())
                    .studentName(student.getFullName())
                    .overallEngagementScore(null)
                    .confusionIndex(null)
                    .alertCount(alerts.size())
                    .lowAttentionFrequency(0)
                    .riskLevel("UNKNOWN")
                    .recommendation("No attention samples recorded for this student yet. Nothing to assess.")
                    .build();
        }

        double emaScore = emaScoreOrNull;

        double confusionIndex = Math.min(100.0, Math.max(5.0, (100.0 - emaScore) * 1.2 + (alerts.size() * 8.0)));
        String riskLevel = "LOW";
        String recommendation = "Maintain current learning momentum. Excellent engagement detected.";

        if (emaScore < 50.0 || alerts.size() > 4) {
            riskLevel = "HIGH";
            recommendation = "High Risk of Disengagement: Schedule 1-on-1 review session. Re-explain recent AI & WebRTC topics.";
        } else if (emaScore < 75.0 || alerts.size() > 2) {
            riskLevel = "MEDIUM";
            recommendation = "Moderate Engagement Fluctuation: Recommend launching quick interactive polls or quick break.";
        }

        return StudentAiAnalysis.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .overallEngagementScore(Math.round(emaScore * 10.0) / 10.0)
                .confusionIndex(Math.round(confusionIndex * 10.0) / 10.0)
                .alertCount(alerts.size())
                .lowAttentionFrequency(lowAttentionCount)
                .riskLevel(riskLevel)
                .recommendation(recommendation)
                .build();
    }

    /**
     * Exam integrity score (0-100) from recorded tab switches and measured
     * attention. A weighted rule, not a classifier: the penalties are constants
     * we chose, and the score is fully explainable from the two inputs.
     */
    public ExamIntegrityAnalysis evaluateExamIntegrity(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null) {
            return ExamIntegrityAnalysis.builder()
                    .integrityConfidenceScore(null)
                    .status("UNKNOWN_ATTEMPT")
                    .flaggedAnomalies(List.of("No such attempt — nothing to evaluate."))
                    .build();
        }

        int tabSwitches = attempt.getTabSwitchCount() != null ? attempt.getTabSwitchCount() : 0;
        boolean attentionMeasured = attempt.getAverageAttentionScore() != null;
        // When attention was never measured, no attention penalty is applied and
        // the caller is told so, rather than assuming a flattering default.
        double avgAttention = attentionMeasured ? attempt.getAverageAttentionScore() : 80.0;

        double penalty = (tabSwitches * 25.0) + Math.max(0, (80.0 - avgAttention) * 1.5);
        double confidenceScore = Math.max(0.0, Math.min(100.0, 100.0 - penalty));

        String status = "VERIFIED_HIGH_INTEGRITY";
        List<String> flags = new ArrayList<>();

        if (tabSwitches > 0) flags.add("Detected " + tabSwitches + " browser tab focus switches.");
        if (!attentionMeasured) {
            flags.add("No attention samples were recorded for this attempt — camera or face model unavailable. Integrity score reflects tab switching only.");
        } else if (avgAttention < 60) {
            flags.add("Average attention dropped below threshold (Score: " + avgAttention + "%).");
        }

        if (confidenceScore < 50.0) {
            status = "FLAGGED_HIGH_CHEATING_RISK";
        } else if (confidenceScore < 80.0) {
            status = "MODERATE_REVIEW_RECOMMENDED";
        }

        return ExamIntegrityAnalysis.builder()
                .attemptId(attempt.getId())
                .studentName(attempt.getStudent().getFullName())
                .integrityConfidenceScore(Math.round(confidenceScore * 10.0) / 10.0)
                .status(status)
                .tabSwitches(tabSwitches)
                .averageAttentionScore(attempt.getAverageAttentionScore()) // null when never measured
                .flaggedAnomalies(flags)
                .build();
    }

    @Data
    @Builder
    public static class StudentAiAnalysis {
        private Long studentId;
        private String studentName;
        private Double overallEngagementScore;
        private Double confusionIndex;
        private Integer alertCount;
        private Integer lowAttentionFrequency;
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
}
