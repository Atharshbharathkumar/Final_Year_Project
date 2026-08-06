package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "exam_attempts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    private Integer score;
    private Integer maxScore;

    private Integer tabSwitchCount;
    private Double averageAttentionScore;

    @Enumerated(EnumType.STRING)
    private AttemptStatus status; // IN_PROGRESS, SUBMITTED, AUTO_SUBMITTED_VIOLATION

    public enum AttemptStatus {
        IN_PROGRESS,
        SUBMITTED,
        AUTO_SUBMITTED_VIOLATION
    }
}
