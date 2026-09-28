package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A student's working state against one assignment. A row is created lazily the
 * first time a student starts or submits, so "no row" means PENDING.
 */
@Entity
@Table(name = "submissions", uniqueConstraints = @UniqueConstraint(columnNames = {"assignment_id", "student_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assignment_id", nullable = false)
    private Assignment assignment;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Enumerated(EnumType.STRING)
    private Status status;

    private String fileName;

    @Column(length = 2000)
    private String feedback;

    /** Marks awarded out of the assignment's points. */
    private Integer grade;

    private LocalDateTime startedAt;
    private LocalDateTime submittedAt;
    private LocalDateTime gradedAt;

    public enum Status {
        PENDING,
        IN_PROGRESS,
        SUBMITTED,
        GRADED
    }
}