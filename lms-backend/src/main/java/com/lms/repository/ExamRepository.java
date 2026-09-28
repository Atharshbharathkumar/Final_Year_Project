package com.lms.repository;

import com.lms.model.Course;
import com.lms.model.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {
    List<Exam> findByCourse(Course course);
    List<Exam> findByCourseInOrderByStartTimeAsc(Collection<Course> courses);
}