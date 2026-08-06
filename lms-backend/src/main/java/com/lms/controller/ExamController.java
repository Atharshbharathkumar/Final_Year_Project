package com.lms.controller;

import com.lms.dto.ExamSubmissionDto;
import com.lms.model.Exam;
import com.lms.model.ExamAttempt;
import com.lms.model.ProctoringSnapshot;
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

    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<Exam>> getExamsByCourse(@PathVariable Long courseId) {
        return ResponseEntity.ok(examService.getExamsByCourse(courseId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Exam> getExamById(@PathVariable Long id) {
        return ResponseEntity.ok(examService.getExamById(id));
    }

    @PostMapping("/course/{courseId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Exam> createExam(@RequestBody Exam exam, @PathVariable Long courseId) {
        return ResponseEntity.ok(examService.createExam(exam, courseId));
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<ExamAttempt> startExamAttempt(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(examService.startExamAttempt(id, authentication.getName()));
    }

    @PostMapping("/submit")
    public ResponseEntity<ExamAttempt> submitExamAttempt(@RequestBody ExamSubmissionDto submissionDto, Authentication authentication) {
        return ResponseEntity.ok(examService.submitExamAttempt(submissionDto, authentication.getName()));
    }

    @PostMapping("/snapshot")
    public ResponseEntity<ProctoringSnapshot> saveSnapshot(@RequestBody SnapshotRequest request) {
        return ResponseEntity.ok(monitoringService.saveSnapshot(
                request.getAttemptId(),
                request.getBase64Image(),
                request.getReason()
        ));
    }

    @GetMapping("/my-attempts")
    public ResponseEntity<List<ExamAttempt>> getMyAttempts(Authentication authentication) {
        return ResponseEntity.ok(examService.getStudentAttempts(authentication.getName()));
    }

    @GetMapping("/{id}/attempts")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<List<ExamAttempt>> getExamAttemptsForTeacher(@PathVariable Long id) {
        return ResponseEntity.ok(examService.getExamAttemptsForTeacher(id));
    }

    @Data
    public static class SnapshotRequest {
        private Long attemptId;
        private String base64Image;
        private String reason;
    }
}
