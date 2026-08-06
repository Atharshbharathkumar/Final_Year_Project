package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Links a PARENT user to a STUDENT they may view.
 *
 * Modelled as its own entity rather than a column on User because a parent can
 * have several children in the system and a student can have two guardians.
 * Every parent-facing query goes through this table — a parent can read a
 * student's records only if a link exists.
 */
@Entity
@Table(
    name = "parent_links",
    uniqueConstraints = @UniqueConstraint(columnNames = {"parent_id", "student_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParentLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "parent_id", nullable = false)
    private User parent;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    /** e.g. "Mother", "Father", "Guardian". Free text; not used for access control. */
    private String relationship;

    private LocalDateTime linkedAt;

    @PrePersist
    protected void onCreate() {
        if (linkedAt == null) linkedAt = LocalDateTime.now();
    }
}
