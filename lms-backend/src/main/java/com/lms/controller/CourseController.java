package com.lms.controller;

import com.lms.model.Course;
import com.lms.model.Enrollment;
import com.lms.model.User;
import com.lms.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ResponseEntity<List<Course>> getAllCourses() {
        return ResponseEntity.ok(courseService.getAllCourses());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Course> getCourseById(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getCourseById(id));
    }

    @GetMapping("/student/my-courses")
    public ResponseEntity<List<Course>> getMyEnrolledCourses(Authentication authentication) {
        return ResponseEntity.ok(courseService.getEnrolledCoursesForStudent(
                ((com.lms.security.UserPrincipal) authentication.getPrincipal()).getId()
        ));
    }

    @PostMapping
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Course> createCourse(@RequestBody Course course, Authentication authentication) {
        return ResponseEntity.ok(courseService.createCourse(course, authentication.getName()));
    }

    @PostMapping("/{id}/enroll")
    public ResponseEntity<Enrollment> enrollCourse(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(courseService.enrollStudent(id, authentication.getName()));
    }

    @GetMapping("/{id}/students")
    public ResponseEntity<List<User>> getEnrolledStudents(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getEnrolledStudents(id));
    }
}
