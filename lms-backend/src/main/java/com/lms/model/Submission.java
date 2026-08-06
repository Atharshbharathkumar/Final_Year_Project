package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A student's response to an assignment.
 *
 * Text-only: there is no file upload. Storing binaries would need a storage
 * strategy and virus scanning that this project does not have, so the scope is
 * an explicit text answer plus an optional external link.
 */
@Entity
@Table(
    name = "submissions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"assignment_id", "student_id"})
)
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

    @Column(length = 8000)
    private String content;

    private String linkUrl;

    private LocalDateTime submittedAt;

    /** True when submittedAt is after the assignment's dueDate. Set on submit. */
    private Boolean late;

    // --- Grading. Null until a teacher grades it. ---
    private Integer marksAwarded;

    @Column(length = 2000)
    private String feedback;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "graded_by_id")
    private User gradedBy;

    private LocalDateTime gradedAt;

    @PrePersist
    protected void onCreate() {
        if (submittedAt == null) submittedAt = LocalDateTime.now();
    }
}
