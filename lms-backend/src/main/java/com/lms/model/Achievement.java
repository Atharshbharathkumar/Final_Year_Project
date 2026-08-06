package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A recognised student accomplishment.
 *
 * This is the "centralised achievement record" the project set out to provide:
 * academic, sporting, project and extracurricular results in one place instead
 * of scattered across departments. Records are created by teachers and admins
 * only — a student cannot award themselves.
 */
@Entity
@Table(name = "achievements")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category;

    /** e.g. "First place", "Runner up", "Certificate of merit". */
    private String level;

    private LocalDate awardedOn;

    /** Contribution to the student's total. Kept small and explicit. */
    private Integer points;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "awarded_by_id")
    private User awardedBy;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (points == null) points = 0;
        if (awardedOn == null) awardedOn = LocalDate.now();
    }

    public enum Category { ACADEMIC, SPORTS, PROJECT, EXTRACURRICULAR, OTHER }
}
