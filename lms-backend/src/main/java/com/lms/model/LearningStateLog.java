package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One transition of the Adaptive Learning State Engine. Rows are produced by
 * {@code AlseService} from attention logs, alerts and coursework activity, so
 * every state carries the evidence that produced it.
 */
@Entity
@Table(name = "learning_state_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearningStateLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    private Long sessionId;

    @Enumerated(EnumType.STRING)
    private LearningState state;

    /** Human-readable reason the engine moved to this state. */
    @Column(length = 500)
    private String evidence;

    /** 0-100 model confidence. */
    private Integer confidence;

    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = LocalDateTime.now();
    }

    public enum LearningState {
        FOCUSED,
        DEEP_LEARNING,
        COLLABORATIVE,
        PASSIVE_LEARNING,
        DISTRACTED,
        STRUGGLING
    }
}