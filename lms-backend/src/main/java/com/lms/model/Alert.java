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

    /**
     * Set when a teacher forgives this alert — readmitting a removed student,
     * for instance. Resolved alerts stop counting towards enforcement but stay
     * on the record, so the audit trail is never rewritten.
     */
    private Boolean resolved;

    private LocalDateTime resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_id")
    private User resolvedBy;

    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = LocalDateTime.now();
        if (resolved == null) resolved = false;
    }

    public enum AlertType {
        NO_FACE,
        MULTIPLE_FACES,
        LOOKING_AWAY,
        TAB_SWITCH,
        LOW_ATTENTION,
        /** The student left the class window for another application. */
        OFF_TASK,
        /** The student stopped sharing their screen mid-session. */
        SCREEN_SHARE_STOPPED
    }

    public enum Severity {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }
}
