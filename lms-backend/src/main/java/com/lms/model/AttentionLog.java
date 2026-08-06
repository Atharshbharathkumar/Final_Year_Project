package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "attention_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttentionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    private Long sessionId; // Classroom session ID or Exam attempt ID
    private String contextType; // "CLASSROOM" or "EXAM"

    private Double score; // 0.0 to 100.0
    private Boolean faceDetected;
    private Integer faceCount;
    private String eyeStatus; // "CENTER", "LOOKING_AWAY", "EYES_CLOSED"
    private Boolean isTabActive;

    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = LocalDateTime.now();
    }
}
