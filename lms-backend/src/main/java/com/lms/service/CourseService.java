package com.lms.service;

import com.lms.model.Course;
import com.lms.model.Enrollment;
import com.lms.model.User;
import com.lms.repository.CourseRepository;
import com.lms.repository.EnrollmentRepository;
import com.lms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;

    public List<Course> getAllCourses() {
        return courseRepository.findAll();
    }

    public Course getCourseById(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Course not found with id: " + id));
    }

    public List<Course> getCoursesByTeacher(Long teacherId) {
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));
        return courseRepository.findByTeacher(teacher);
    }

    public List<Course> getEnrolledCoursesForStudent(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        return enrollmentRepository.findByStudent(student).stream()
                .map(Enrollment::getCourse)
                .collect(Collectors.toList());
    }

    @Transactional
    public Course createCourse(Course course, String teacherEmail) {
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));
        course.setTeacher(teacher);
        return courseRepository.save(course);
    }

    @Transactional
    public Enrollment enrollStudent(Long courseId, String studentEmail) {
        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        Course course = getCourseById(courseId);

        if (enrollmentRepository.findByStudentAndCourse(student, course).isPresent()) {
            throw new RuntimeException("Student is already enrolled in this course");
        }

        Enrollment enrollment = Enrollment.builder()
                .student(student)
                .course(course)
                .build();
        return enrollmentRepository.save(enrollment);
    }

    public List<User> getEnrolledStudents(Long courseId) {
        Course course = getCourseById(courseId);
        return enrollmentRepository.findByCourse(course).stream()
                .map(Enrollment::getStudent)
                .collect(Collectors.toList());
    }
}
