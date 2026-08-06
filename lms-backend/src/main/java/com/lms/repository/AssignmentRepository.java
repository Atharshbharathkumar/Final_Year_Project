package com.lms.repository;

import com.lms.model.Assignment;
import com.lms.model.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentRepository extends JpaRepository<Assignment, Long> {
    List<Assignment> findByCourseOrderByDueDateAsc(Course course);
    List<Assignment> findByCourseInOrderByDueDateAsc(List<Course> courses);
}
