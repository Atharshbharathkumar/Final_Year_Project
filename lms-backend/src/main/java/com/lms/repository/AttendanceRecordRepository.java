package com.lms.repository;

import com.lms.model.AttendanceRecord;
import com.lms.model.Course;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    List<AttendanceRecord> findByStudent(User student);
    List<AttendanceRecord> findByStudentIn(Collection<User> students);
    List<AttendanceRecord> findByCourse(Course course);
    List<AttendanceRecord> findBySessionDateBetween(LocalDate from, LocalDate to);
    long countByStudentAndPresentTrue(User student);
    long countByStudent(User student);
}