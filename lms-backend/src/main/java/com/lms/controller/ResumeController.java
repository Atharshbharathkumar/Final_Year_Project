package com.lms.controller;

import com.lms.dto.ResumeDtos;
import com.lms.model.User;
import com.lms.security.CurrentUser;
import com.lms.service.ResumeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/resume")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;
    private final CurrentUser currentUser;

    /** Scores resume text extracted in the browser and stores the result. */
    @PostMapping("/analyze")
    public ResponseEntity<ResumeDtos.ResumeResult> analyze(@RequestBody ResumeDtos.AnalyzeRequest request,
                                                           Authentication authentication) {
        User student = currentUser.subjectStudent(authentication);
        return ResponseEntity.ok(resumeService.analyze(student, request.getFileName(), request.getText()));
    }

    /** The most recent analysis, or 204 when the student has never uploaded one. */
    @GetMapping("/latest")
    public ResponseEntity<ResumeDtos.ResumeResult> latest(Authentication authentication) {
        User student = currentUser.subjectStudent(authentication);
        return resumeService.latest(student)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}