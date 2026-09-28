package com.lms.dto;

import com.lms.model.Question;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Payloads for sitting a proctored exam.
 * <p>
 * The paper deliberately has no {@code correctAnswer} field anywhere. Returning
 * the {@code Exam} entity directly would ship the answer key to the browser.
 */
public final class ExamDtos {

    private ExamDtos() {
    }

    /** A question as the candidate sees it — options only, never the key. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaperQuestion {
        private Long id;
        private String questionText;
        private Question.QuestionType type;
        private String optionA;
        private String optionB;
        private String optionC;
        private String optionD;
        private Integer marks;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExamPaper {
        private Long id;
        private String title;
        private String description;
        private String courseName;
        private String courseCode;
        private Integer durationMinutes;
        private Boolean lockdownEnabled;
        private Boolean cameraRequired;
        private Integer maxTabSwitches;
        private Integer totalMarks;
        private Integer questionCount;
        private List<PaperQuestion> questions;
    }

    /**
     * Live state of an attempt. {@code secondsRemaining} is computed from the
     * server's clock so a candidate cannot buy time by changing their own.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttemptState {
        private Long attemptId;
        private Long examId;
        private String status;
        private String startedAt;
        private String deadline;
        private long secondsRemaining;
        private Integer tabSwitchCount;
        private Integer maxTabSwitches;
        private Boolean expired;
        /** Answers already saved, so a refresh mid-exam loses nothing. */
        private Map<Long, String> savedAnswers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttemptResult {
        private Long attemptId;
        private String examTitle;
        private String courseName;
        private String studentName;
        private Integer score;
        private Integer maxScore;
        private Integer percentage;
        private String status;
        private Integer tabSwitchCount;
        private String submittedAt;
        private Integer questionsAnswered;
        private Integer questionCount;
        /** Populated from the integrity model so the candidate sees the verdict. */
        private Double integrityScore;
        private String integrityStatus;
        private List<String> integrityFlags;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveAnswerRequest {
        private Long questionId;
        private String answer;
    }

    /** Result of reporting that the candidate left the exam window. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TabSwitchResult {
        private Integer tabSwitchCount;
        private Integer maxTabSwitches;
        /** True when the limit is reached and the attempt was auto-submitted. */
        private Boolean terminated;
        private String message;
    }
}