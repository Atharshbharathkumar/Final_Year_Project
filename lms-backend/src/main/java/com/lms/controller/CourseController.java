package com.lms.controller;

import com.lms.dto.AcademicDtos;
import com.lms.model.Course;
import com.lms.model.Enrollment;
import com.lms.model.User;
import com.lms.security.CurrentUser;
import com.lms.service.AcademicService;
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
    private final AcademicService academicService;
    private final CurrentUser currentUser;

    /**
     * The course cards the UI renders: a student sees their enrolled courses with
     * personal progress and grade, a teacher sees the courses they own with the
     * cohort mean, and an admin sees the catalogue.
     */
    @GetMapping("/my")
    public ResponseEntity<List<AcademicDtos.CourseCard>> myCourses(Authentication authentication) {
        User caller = currentUser.require(authentication);
        return switch (caller.getRole()) {
            case TEACHER -> ResponseEntity.ok(academicService.coursesForTeacher(caller));
            case ADMIN -> ResponseEntity.ok(academicService.allCourses());
            case PARENT, STUDENT ->
                    ResponseEntity.ok(academicService.coursesForStudent(currentUser.subjectStudent(authentication)));
        };
    }

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
                currentUser.subjectStudent(authentication).getId()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AcademicDtos.CourseCard> createCourse(@RequestBody AcademicDtos.CreateCourseRequest request,
                                                                Authentication authentication) {
        return ResponseEntity.ok(academicService.createCourse(request, currentUser.require(authentication)));
    }

    @PostMapping("/{id}/enroll")
    public ResponseEntity<Enrollment> enrollCourse(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(courseService.enrollStudent(id, authentication.getName()));
    }

    @GetMapping("/{id}/students")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<List<User>> getEnrolledStudents(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getEnrolledStudents(id));
    }
}