package com.lms.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    @Column(nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String avatarUrl;

    /** Emoji avatar rendered by the UI roster//navbar. */
    private String avatarEmoji;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    /** Academic year of study, students only. */
    private Integer studyYear;

    /** Latest computed GPA (0.0 - 4.0), refreshed from graded work. */
    private Double gpa;

    /**
     * For PARENT accounts: the student this guardian is allowed to observe.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "linked_student_id")
    @JsonIgnore
    private User linkedStudent;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public enum Role {
        STUDENT,
        TEACHER,
        PARENT,
        ADMIN
    }
}