package com.lms.repository;

import com.lms.model.ClassroomSession;
import com.lms.model.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomSessionRepository extends JpaRepository<ClassroomSession, Long> {
    List<ClassroomSession> findByCourse(Course course);
    List<ClassroomSession> findByIsActiveTrue();
    Optional<ClassroomSession> findFirstByIsActiveTrueOrderByStartTimeDesc();
    long countByIsActiveTrue();
}