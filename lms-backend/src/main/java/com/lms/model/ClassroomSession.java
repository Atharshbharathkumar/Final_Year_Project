package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "classroom_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassroomSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @ManyToOne
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne
    @JoinColumn(name = "host_teacher_id", nullable = false)
    private User hostTeacher;

    private Boolean isActive;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    @PrePersist
    protected void onCreate() {
        if (startTime == null) startTime = LocalDateTime.now();
        if (isActive == null) isActive = true;
    }
}
