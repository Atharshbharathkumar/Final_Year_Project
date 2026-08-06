package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamSubmissionDto {
    private Long attemptId;
    private Map<Long, String> answers; // QuestionId -> SelectedOption/AnswerText
    private Integer tabSwitchCount;
    // averageAttentionScore was removed: it is now computed server-side from the
    // recorded attention logs in ExamService.submitExamAttempt. Accepting it from
    // the client let the browser being proctored report its own integrity score.
}
