package com.lms.repository;

import com.lms.model.Answer;
import com.lms.model.ExamAttempt;
import com.lms.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnswerRepository extends JpaRepository<Answer, Long> {
    List<Answer> findByAttempt(ExamAttempt attempt);
    Optional<Answer> findByAttemptAndQuestion(ExamAttempt attempt, Question question);
}
