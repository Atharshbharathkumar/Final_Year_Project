package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "courses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String courseCode;

    @Column(length = 2000)
    private String description;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    private String coverImage;

    /** Accent colour the course cards render with, e.g. "#6366f1". */
    private String color;

    /** Emoji tile shown next to the course name. */
    private String icon;

    private Integer creditHours;

    private String semester;

    /** Number of teaching sessions in the syllabus, used for progress %. */
    private Integer totalSessions;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
