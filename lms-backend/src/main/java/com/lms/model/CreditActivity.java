package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * A co-curricular achievement that earned a student academic credits.
 */
@Entity
@Table(name = "credit_activities")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreditActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    private Category category;

    private Integer credits;

    private LocalDate awardedOn;

    public enum Category {
        WORKSHOP,
        COMPETITION,
        CERTIFICATION,
        RESEARCH,
        VOLUNTEERING,
        CLUB,
        TIMELY_SUBMISSION
    }
}