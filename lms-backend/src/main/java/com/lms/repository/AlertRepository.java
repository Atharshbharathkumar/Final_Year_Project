package com.lms.repository;

import com.lms.model.Alert;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findBySessionIdAndContextTypeOrderByTimestampDesc(Long sessionId, String contextType);
    List<Alert> findByStudentOrderByTimestampDesc(User student);
    List<Alert> findAllByOrderByTimestampDesc();
}
