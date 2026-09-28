package com.lms.repository;

import com.lms.model.CampusEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CampusEventRepository extends JpaRepository<CampusEvent, Long> {
    List<CampusEvent> findByStartsAtAfterOrderByStartsAtAsc(LocalDateTime after);
    List<CampusEvent> findAllByOrderByStartsAtAsc();
}