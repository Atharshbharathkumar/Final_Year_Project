package com.lms.controller;

import com.lms.dto.ExamDtos;
import com.lms.dto.ExamSubmissionDto;
import com.lms.model.Exam;
import com.lms.model.ProctoringSnapshot;
import com.lms.security.CurrentUser;
import com.lms.service.ExamService;
import com.lms.service.MonitoringService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;
    private final MonitoringService monitoringService;
    private final CurrentUser currentUser;

    /**
     * The candidate's view of the paper — options without the answer key.
     * Prefer this over {@code GET /exams/{id}}, which returns the full entity
     * and is restricted to staff.
     */
    @GetMapping("/{id}/paper")
    public ResponseEntity<ExamDtos.ExamPaper> getPaper(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(examService.getPaper(id, currentUser.require(authentication)));
    }

    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<Exam>> getExamsByCourse(@PathVariable Long courseId) {
        return ResponseEntity.ok(examService.getExamsByCourse(courseId));
    }

    /** Staff only: this carries the answer key. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<Exam> getExamById(@PathVariable Long id) {
        return ResponseEntity.ok(examService.getExamById(id));
    }

    @PostMapping("/course/{courseId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<Exam> createExam(@RequestBody Exam exam, @PathVariable Long courseId) {
        return ResponseEntity.ok(examService.createExam(exam, courseId));
    }

    // ─────────────────────────────── attempts ────────────────────────────────

    /** Starts a new attempt or resumes the one in progress. */
    @PostMapping("/{id}/start")
    public ResponseEntity<ExamDtos.AttemptState> startAttempt(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(examService.startAttempt(id, currentUser.require(authentication)));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<ExamDtos.AttemptState> attemptState(@PathVariable Long attemptId, Authentication authentication) {
        return ResponseEntity.ok(examService.getAttemptState(attemptId, currentUser.require(authentication)));
    }

    /** Autosaves a single answer while the candidate works. */
    @PostMapping("/attempts/{attemptId}/answer")
    public ResponseEntity<Void> saveAnswer(@PathVariable Long attemptId,
                                           @RequestBody ExamDtos.SaveAnswerRequest request,
                                           Authentication authentication) {
        examService.saveAnswer(attemptId, currentUser.require(authentication),
                request.getQuestionId(), request.getAnswer());
        return ResponseEntity.noContent().build();
    }

    /** Reports that the exam window lost focus; may terminate the attempt. */
    @PostMapping("/attempts/{attemptId}/tab-switch")
    public ResponseEntity<ExamDtos.TabSwitchResult> tabSwitch(@PathVariable Long attemptId, Authentication authentication) {
        return ResponseEntity.ok(examService.registerTabSwitch(attemptId, currentUser.require(authentication)));
    }

    @PostMapping("/submit")
    public ResponseEntity<ExamDtos.AttemptResult> submit(@RequestBody ExamSubmissionDto submissionDto,
                                                         Authentication authentication) {
        return ResponseEntity.ok(examService.submit(submissionDto, currentUser.require(authentication)));
    }

    @GetMapping("/attempts/{attemptId}/result")
    public ResponseEntity<ExamDtos.AttemptResult> result(@PathVariable Long attemptId, Authentication authentication) {
        return ResponseEntity.ok(examService.getResult(attemptId, currentUser.require(authentication)));
    }

    @PostMapping("/snapshot")
    public ResponseEntity<ProctoringSnapshot> saveSnapshot(@RequestBody SnapshotRequest request) {
        return ResponseEntity.ok(monitoringService.saveSnapshot(
                request.getAttemptId(), request.getBase64Image(), request.getReason()));
    }

    /** This candidate's attempt at one exam, or 204 if they have not started it. */
    @GetMapping("/{id}/my-attempt")
    public ResponseEntity<ExamDtos.AttemptState> myAttempt(@PathVariable Long id, Authentication authentication) {
        return examService.findMyAttempt(id, currentUser.require(authentication))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/my-attempts")
    public ResponseEntity<List<ExamDtos.AttemptResult>> getMyAttempts(Authentication authentication) {
        return ResponseEntity.ok(examService.getStudentAttempts(authentication.getName()));
    }

    @GetMapping("/{id}/attempts")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<ExamDtos.AttemptResult>> getExamAttemptsForTeacher(@PathVariable Long id) {
        return ResponseEntity.ok(examService.getExamAttemptsForTeacher(id));
    }

    @Data
    public static class SnapshotRequest {
        private Long attemptId;
        private String base64Image;
        private String reason;
    }
}