package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttentionPayloadDto {
    private Long studentId;
    private String studentName;
    private Long sessionId;
    private String contextType; // "CLASSROOM" or "EXAM"
    private Double score;
    private Boolean faceDetected;
    private Integer faceCount;
    private String eyeStatus;
    private Boolean isTabActive;
    private Long timestamp;
}
