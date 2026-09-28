package com.lms.controller;

import com.lms.dto.AcademicDtos;
import com.lms.model.User;
import com.lms.security.CurrentUser;
import com.lms.service.AcademicService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final AcademicService academicService;
    private final CurrentUser currentUser;

    /** Teacher accounts get the cohort view; everyone else gets the student view. */
    @GetMapping("/my")
    public ResponseEntity<List<AcademicDtos.AssignmentCard>> my(Authentication authentication) {
        User caller = currentUser.require(authentication);
        if (caller.getRole() == User.Role.TEACHER || caller.getRole() == User.Role.ADMIN) {
            return ResponseEntity.ok(academicService.assignmentsForTeacher(caller));
        }
        return ResponseEntity.ok(academicService.assignmentsForStudent(currentUser.subjectStudent(authentication)));
    }

    /** Teacher authoring: create a new assignment on a course you own. */
    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AcademicDtos.AssignmentCard> create(@RequestBody AcademicDtos.CreateAssignmentRequest request,
                                                              Authentication authentication) {
        return ResponseEntity.ok(academicService.createAssignment(request, currentUser.require(authentication)));
    }

    /** The grading queue: submitted work across every course you own. */
    @GetMapping("/submissions")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AcademicDtos.SubmissionCard>> submissions(
            @RequestParam(defaultValue = "false") boolean includeGraded,
            Authentication authentication) {
        return ResponseEntity.ok(academicService.gradingQueue(currentUser.require(authentication), includeGraded));
    }

    @PostMapping("/submissions/{id}/grade")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AcademicDtos.SubmissionCard> grade(@PathVariable Long id,
                                                             @RequestBody AcademicDtos.GradeRequest request,
                                                             Authentication authentication) {
        return ResponseEntity.ok(academicService.gradeSubmission(id, request, currentUser.require(authentication)));
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<AcademicDtos.AssignmentCard> start(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(academicService.startAssignment(id, currentUser.require(authentication)));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<AcademicDtos.AssignmentCard> submit(@PathVariable Long id,
                                                              @RequestBody(required = false) SubmitRequest request,
                                                              Authentication authentication) {
        String fileName = request != null ? request.getFileName() : null;
        return ResponseEntity.ok(academicService.submitAssignment(id, currentUser.require(authentication), fileName));
    }

    @Data
    public static class SubmitRequest {
        private String fileName;
    }
}