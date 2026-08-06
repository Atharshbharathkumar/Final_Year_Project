package com.lms.repository;

import com.lms.model.AttendanceRecord;
import com.lms.model.Course;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    Optional<AttendanceRecord> findByStudentAndCourseAndDate(User student, Course course, LocalDate date);
    List<AttendanceRecord> findByCourseAndDateOrderByStudentAsc(Course course, LocalDate date);
    List<AttendanceRecord> findByStudentOrderByDateDesc(User student);
    List<AttendanceRecord> findByStudentAndCourseOrderByDateDesc(User student, Course course);
    long countByStudentAndStatus(User student, AttendanceRecord.Status status);
    long countByStudent(User student);
}
