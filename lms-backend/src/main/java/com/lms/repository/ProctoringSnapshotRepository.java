package com.lms.repository;

import com.lms.model.ExamAttempt;
import com.lms.model.ProctoringSnapshot;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProctoringSnapshotRepository extends JpaRepository<ProctoringSnapshot, Long> {
    List<ProctoringSnapshot> findByAttempt(ExamAttempt attempt);
    List<ProctoringSnapshot> findByStudentOrderByTimestampDesc(User student);
}
