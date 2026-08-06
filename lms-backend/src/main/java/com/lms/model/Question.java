package com.lms.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "questions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id")
    @JsonIgnore
    private Exam exam;

    @Column(nullable = false, length = 1000)
    private String questionText;

    @Enumerated(EnumType.STRING)
    private QuestionType type; // MCQ, SHORT_ANSWER

    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;

    private String correctAnswer; // "A", "B", "C", "D" or short text

    private Integer marks;

    public enum QuestionType {
        MCQ,
        SHORT_ANSWER
    }
}
