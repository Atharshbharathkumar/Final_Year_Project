package com.lms.repository;

import com.lms.model.Assignment;
import com.lms.model.Submission;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    List<Submission> findByStudent(User student);
    List<Submission> findByAssignment(Assignment assignment);
    List<Submission> findByAssignmentIn(Collection<Assignment> assignments);
    Optional<Submission> findByAssignmentAndStudent(Assignment assignment, User student);
    long countByStatus(Submission.Status status);
}