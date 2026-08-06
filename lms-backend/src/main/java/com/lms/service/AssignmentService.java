package com.lms.service;

import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AccessGuard accessGuard;

    public List<Assignment> getByCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        return assignmentRepository.findByCourseOrderByDueDateAsc(course);
    }

    /** Assignments across every course the student is enrolled in. */
    public List<Assignment> getForStudent(User student) {
        List<Course> courses = enrollmentRepository.findByStudent(student).stream()
                .map(Enrollment::getCourse)
                .collect(Collectors.toList());
        if (courses.isEmpty()) return List.of();
        return assignmentRepository.findByCourseInOrderByDueDateAsc(courses);
    }

    @Transactional
    public Assignment create(Long courseId, Assignment assignment, User creator) {
        accessGuard.requireStaff(creator);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        assignment.setId(null);
        assignment.setCourse(course);
        assignment.setCreatedBy(creator);
        return assignmentRepository.save(assignment);
    }

    /**
     * Creates or replaces this student's submission. Re-submitting before the
     * deadline overwrites the previous attempt; once graded it is locked, so a
     * student cannot quietly change an answer after seeing their mark.
     */
    @Transactional
    public Submission submit(Long assignmentId, User student, String content, String linkUrl) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found"));

        Submission submission = submissionRepository
                .findByAssignmentAndStudent(assignment, student)
                .orElseGet(() -> Submission.builder().assignment(assignment).student(student).build());

        if (submission.getMarksAwarded() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This submission has already been graded and can no longer be changed.");
        }

        LocalDateTime now = LocalDateTime.now();
        submission.setContent(content);
        submission.setLinkUrl(linkUrl);
        submission.setSubmittedAt(now);
        submission.setLate(assignment.getDueDate() != null && now.isAfter(assignment.getDueDate()));

        return submissionRepository.save(submission);
    }

    public List<Submission> getSubmissions(Long assignmentId, User viewer) {
        accessGuard.requireStaff(viewer);
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found"));
        return submissionRepository.findByAssignmentOrderBySubmittedAtAsc(assignment);
    }

    public List<Submission> getStudentSubmissions(User student) {
        return submissionRepository.findByStudentOrderBySubmittedAtDesc(student);
    }

    @Transactional
    public Submission grade(Long submissionId, Integer marks, String feedback, User grader) {
        accessGuard.requireStaff(grader);
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));

        Integer max = submission.getAssignment().getMaxMarks();
        if (marks == null || marks < 0 || (max != null && marks > max)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Marks must be between 0 and " + max);
        }

        submission.setMarksAwarded(marks);
        submission.setFeedback(feedback);
        submission.setGradedBy(grader);
        submission.setGradedAt(LocalDateTime.now());
        return submissionRepository.save(submission);
    }
}
