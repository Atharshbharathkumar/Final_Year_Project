package com.lms.repository;

import com.lms.model.LearningStateLog;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LearningStateLogRepository extends JpaRepository<LearningStateLog, Long> {
    List<LearningStateLog> findByStudentOrderByTimestampAsc(User student);
    List<LearningStateLog> findByStudentAndSessionIdOrderByTimestampAsc(User student, Long sessionId);
}