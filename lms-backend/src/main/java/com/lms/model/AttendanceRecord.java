package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One student's attendance for one course on one date.
 *
 * {@code source} records how the mark was arrived at. AUTO_SESSION marks are
 * derived from attention samples recorded during a live class, so a teacher can
 * see which marks were inferred from camera presence rather than entered by a
 * person — and can override them, which flips the source to MANUAL.
 */
@Entity
@Table(
    name = "attendance_records",
    uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "course_id", "date"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Enumerated(EnumType.STRING)
    private Source source;

    /** Populated for AUTO_SESSION marks: the classroom session it was derived from. */
    private Long sessionId;

    /** Populated for AUTO_SESSION marks: how many attention samples were seen. */
    private Integer sampleCount;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "marked_by_id")
    private User markedBy;

    private LocalDateTime markedAt;

    @PrePersist
    protected void onCreate() {
        if (markedAt == null) markedAt = LocalDateTime.now();
        if (source == null) source = Source.MANUAL;
    }

    public enum Status { PRESENT, ABSENT, LATE, EXCUSED }

    public enum Source { MANUAL, AUTO_SESSION }
}
