package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "proctoring_snapshots")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProctoringSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    private String imagePath;
    private String triggerReason; // "INTERVAL", "MULTI_FACE", "TAB_SWITCH", "NO_FACE"
    private Boolean flagged;

    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = LocalDateTime.now();
        if (flagged == null) flagged = false;
    }
}
