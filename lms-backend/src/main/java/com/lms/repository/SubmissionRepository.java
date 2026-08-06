package com.lms.repository;

import com.lms.model.Assignment;
import com.lms.model.Submission;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    Optional<Submission> findByAssignmentAndStudent(Assignment assignment, User student);
    List<Submission> findByAssignmentOrderBySubmittedAtAsc(Assignment assignment);
    List<Submission> findByStudentOrderBySubmittedAtDesc(User student);
}
