package com.lms.repository;

import com.lms.model.AttentionLog;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface AttentionLogRepository extends JpaRepository<AttentionLog, Long> {
    List<AttentionLog> findBySessionIdAndContextTypeOrderByTimestampAsc(Long sessionId, String contextType);
    List<AttentionLog> findByStudentAndSessionIdAndContextType(User student, Long sessionId, String contextType);
    List<AttentionLog> findByStudent(User student);
    List<AttentionLog> findByStudentOrderByTimestampAsc(User student);
    List<AttentionLog> findByStudentIn(Collection<User> students);
    List<AttentionLog> findByTimestampBetween(LocalDateTime from, LocalDateTime to);
    List<AttentionLog> findByStudentAndTimestampBetween(User student, LocalDateTime from, LocalDateTime to);
}