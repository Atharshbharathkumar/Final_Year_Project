package com.lms.repository;

import com.lms.model.AttentionLog;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttentionLogRepository extends JpaRepository<AttentionLog, Long> {
    List<AttentionLog> findBySessionIdAndContextTypeOrderByTimestampAsc(Long sessionId, String contextType);
    List<AttentionLog> findByStudentAndSessionIdAndContextType(User student, Long sessionId, String contextType);
    List<AttentionLog> findByStudent(User student);

    /**
     * Mean of the scores actually recorded for this student in this session.
     * Rows with a null score are samples where the vision engine was degraded or
     * the tab was hidden — they were never measured, so they are excluded rather
     * than counted as zero. Returns null when nothing was measured at all.
     */
    @Query("SELECT AVG(a.score) FROM AttentionLog a " +
           "WHERE a.student = :student AND a.sessionId = :sessionId " +
           "AND a.contextType = :contextType AND a.score IS NOT NULL")
    Double averageScoreFor(@Param("student") User student,
                           @Param("sessionId") Long sessionId,
                           @Param("contextType") String contextType);

    long countByStudentAndSessionIdAndContextTypeAndScoreIsNotNull(User student, Long sessionId, String contextType);
}
