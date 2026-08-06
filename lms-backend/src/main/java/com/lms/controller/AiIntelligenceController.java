package com.lms.controller;

import com.lms.service.AiIntelligenceService;
import com.lms.service.CourseSearchService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiIntelligenceController {

    private final AiIntelligenceService aiIntelligenceService;
    private final CourseSearchService courseSearchService;

    @GetMapping("/predict-risk/{studentId}")
    public ResponseEntity<AiIntelligenceService.StudentAiAnalysis> predictRisk(@PathVariable Long studentId) {
        return ResponseEntity.ok(aiIntelligenceService.predictStudentRisk(studentId));
    }

    @GetMapping("/exam-integrity/{attemptId}")
    public ResponseEntity<AiIntelligenceService.ExamIntegrityAnalysis> evaluateExamIntegrity(@PathVariable Long attemptId) {
        return ResponseEntity.ok(aiIntelligenceService.evaluateExamIntegrity(attemptId));
    }

    /**
     * Searches the course material in this system. Returns matched excerpts with
     * their source, or an explicit no-match. It does not generate text.
     */
    @PostMapping("/copilot/ask")
    public ResponseEntity<CourseSearchService.SearchAnswer> askCopilot(@RequestBody CopilotRequest request) {
        return ResponseEntity.ok(courseSearchService.search(request.getQuestion()));
    }

    @Data
    public static class CopilotRequest {
        private String question;
    }
}
