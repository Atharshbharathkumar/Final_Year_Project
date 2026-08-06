package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    private Long sessionId; // Classroom session ID or Exam ID
    private String contextType; // "CLASSROOM" or "EXAM"

    @Enumerated(EnumType.STRING)
    private AlertType alertType; // NO_FACE, MULTIPLE_FACES, LOOKING_AWAY, TAB_SWITCH, LOW_ATTENTION

    @Enumerated(EnumType.STRING)
    private Severity severity; // LOW, MEDIUM, HIGH, CRITICAL

    private String message;
    private String snapshotPath;

    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = LocalDateTime.now();
    }

    public enum AlertType {
        NO_FACE,
        MULTIPLE_FACES,
        LOOKING_AWAY,
        TAB_SWITCH,
        LOW_ATTENTION
    }

    public enum Severity {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }
}
