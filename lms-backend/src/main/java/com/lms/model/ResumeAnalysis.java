package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Result of scoring an uploaded resume. Section scores are stored as plain
 * columns so the analysis survives a restart and can be re-opened later.
 */
@Entity
@Table(name = "resume_analyses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumeAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    private String fileName;

    private Integer overallScore;

    private Integer formattingScore;
    private Integer skillsScore;
    private Integer experienceScore;
    private Integer educationScore;
    private Integer keywordsScore;
    private Integer impactScore;

    /** Newline-separated improvement suggestions. */
    @Column(length = 4000)
    private String suggestions;

    /** Newline-separated "Industry=match" pairs. */
    @Column(length = 2000)
    private String industryMatches;

    /** Raw extracted text, kept so re-scoring does not need a re-upload. */
    @Column(length = 20000)
    private String extractedText;

    private LocalDateTime analyzedAt;

    @PrePersist
    protected void onCreate() {
        if (analyzedAt == null) analyzedAt = LocalDateTime.now();
    }
}