package com.lms.controller;

import com.lms.security.CurrentUser;
import com.lms.service.AiIntelligenceService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiIntelligenceController {

    private final AiIntelligenceService aiIntelligenceService;
    private final CurrentUser currentUser;

    @GetMapping("/predict-risk/{studentId}")
    public ResponseEntity<AiIntelligenceService.StudentAiAnalysis> predictRisk(@PathVariable Long studentId) {
        return ResponseEntity.ok(aiIntelligenceService.predictStudentRisk(studentId));
    }

    @GetMapping("/exam-integrity/{attemptId}")
    public ResponseEntity<AiIntelligenceService.ExamIntegrityAnalysis> evaluateExamIntegrity(@PathVariable Long attemptId) {
        return ResponseEntity.ok(aiIntelligenceService.evaluateExamIntegrity(attemptId));
    }

    /** Study assistant grounded in the caller's own academic record. */
    @PostMapping("/copilot/ask")
    public ResponseEntity<AiIntelligenceService.CopilotAnswer> askCopilot(@RequestBody CopilotRequest request,
                                                                         Authentication authentication) {
        return ResponseEntity.ok(aiIntelligenceService.askAiCopilot(
                currentUser.subjectStudent(authentication), request.getQuestion()));
    }

    @Data
    public static class CopilotRequest {
        private String question;
    }
}