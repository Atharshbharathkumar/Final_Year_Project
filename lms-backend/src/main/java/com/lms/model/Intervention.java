package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A teacher-approvable action the engine recommends for a struggling student,
 * plus the measured outcome once it has been delivered.
 */
@Entity
@Table(name = "interventions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Intervention {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Enumerated(EnumType.STRING)
    private LearningStateLog.LearningState triggerState;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "intervention_evidence", joinColumns = @JoinColumn(name = "intervention_id"))
    @Column(name = "evidence", length = 500)
    @Builder.Default
    private List<String> evidence = new ArrayList<>();

    @Column(length = 1000)
    private String recommendation;

    @Column(length = 1000)
    private String objective;

    @Enumerated(EnumType.STRING)
    private Status status;

    /** Engagement score captured when the intervention was raised. */
    private Double baselineScore;

    /** Engagement score measured after delivery, null until observed. */
    private Double outcomeScore;

    private String outcomeMetric;

    @Enumerated(EnumType.STRING)
    private LearningStateLog.LearningState resultingState;

    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = Status.PENDING;
    }

    public enum Status {
        PENDING,
        APPROVED,
        REJECTED,
        DELIVERED
    }
}