package com.lms.repository;

import com.lms.model.Exam;
import com.lms.model.ExamAttempt;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Long> {
    List<ExamAttempt> findByStudent(User student);
    List<ExamAttempt> findByExam(Exam exam);
    Optional<ExamAttempt> findByStudentAndExamAndStatus(User student, Exam exam, ExamAttempt.AttemptStatus status);
}
