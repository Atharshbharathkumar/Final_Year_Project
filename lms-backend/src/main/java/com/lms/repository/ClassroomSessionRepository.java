package com.lms.repository;

import com.lms.model.ClassroomSession;
import com.lms.model.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassroomSessionRepository extends JpaRepository<ClassroomSession, Long> {
    List<ClassroomSession> findByCourse(Course course);
    List<ClassroomSession> findByIsActiveTrue();
}
