package com.lms.controller;

import com.lms.model.Assignment;
import com.lms.model.Submission;
import com.lms.model.User;
import com.lms.service.AccessGuard;
import com.lms.service.AssignmentService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final AssignmentService assignmentService;
    private final AccessGuard accessGuard;

    private User caller(UserDetails principal) {
        return accessGuard.requireUser(principal.getUsername());
    }

    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<Assignment>> byCourse(@PathVariable Long courseId) {
        return ResponseEntity.ok(assignmentService.getByCourse(courseId));
    }

    /** Assignments across all courses the signed-in student is enrolled in. */
    @GetMapping("/mine")
    public ResponseEntity<List<Assignment>> mine(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(assignmentService.getForStudent(caller(principal)));
    }

    @PostMapping("/course/{courseId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Assignment> create(@PathVariable Long courseId,
                                             @RequestBody Assignment assignment,
                                             @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(assignmentService.create(courseId, assignment, caller(principal)));
    }

    @PostMapping("/{assignmentId}/submit")
    public ResponseEntity<Submission> submit(@PathVariable Long assignmentId,
                                             @RequestBody SubmitRequest request,
                                             @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(assignmentService.submit(
                assignmentId, caller(principal), request.getContent(), request.getLinkUrl()));
    }

    @GetMapping("/{assignmentId}/submissions")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<List<Submission>> submissions(@PathVariable Long assignmentId,
                                                        @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(assignmentService.getSubmissions(assignmentId, caller(principal)));
    }

    @GetMapping("/submissions/mine")
    public ResponseEntity<List<Submission>> mySubmissions(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(assignmentService.getStudentSubmissions(caller(principal)));
    }

    @PostMapping("/submissions/{submissionId}/grade")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Submission> grade(@PathVariable Long submissionId,
                                            @RequestBody GradeRequest request,
                                            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(assignmentService.grade(
                submissionId, request.getMarksAwarded(), request.getFeedback(), caller(principal)));
    }

    @Data
    public static class SubmitRequest {
        private String content;
        private String linkUrl;
    }

    @Data
    public static class GradeRequest {
        private Integer marksAwarded;
        private String feedback;
    }
}
