package com.lms.dto;

import com.lms.model.Alert;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private Long sessionId;
    private String contextType;
    private Alert.AlertType alertType;
    private Alert.Severity severity;
    private String message;
    private String snapshotPath;
    private LocalDateTime timestamp;
}
