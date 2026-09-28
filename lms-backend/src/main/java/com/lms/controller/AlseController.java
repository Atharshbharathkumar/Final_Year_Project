package com.lms.controller;

import com.lms.dto.AlseDtos;
import com.lms.model.User;
import com.lms.security.CurrentUser;
import com.lms.service.AlseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Adaptive Learning State Engine endpoints: state timeline, digital twin,
 * intervention loop and the what-if simulator.
 */
@RestController
@RequestMapping("/api/alse")
@RequiredArgsConstructor
public class AlseController {

    private final AlseService alseService;
    private final CurrentUser currentUser;

    @GetMapping("/learning-state")
    public ResponseEntity<AlseDtos.LearningStateView> learningState(
            Authentication authentication,
            @RequestParam(required = false) Long studentId) {
        User student = currentUser.subjectStudent(authentication, studentId);
        return ResponseEntity.ok(alseService.learningStateView(student));
    }

    @GetMapping("/digital-twin")
    public ResponseEntity<AlseDtos.DigitalTwin> digitalTwin(
            Authentication authentication,
            @RequestParam(required = false) Long studentId) {
        User student = currentUser.subjectStudent(authentication, studentId);
        return ResponseEntity.ok(alseService.digitalTwin(student));
    }

    @GetMapping("/interventions")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AlseDtos.InterventionSummary> interventions() {
        return ResponseEntity.ok(alseService.interventionSummary());
    }

    @PostMapping("/interventions/{id}/approve")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AlseDtos.InterventionView> approve(@PathVariable Long id) {
        return ResponseEntity.ok(alseService.decide(id, true));
    }

    @PostMapping("/interventions/{id}/reject")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AlseDtos.InterventionView> reject(@PathVariable Long id) {
        return ResponseEntity.ok(alseService.decide(id, false));
    }

    @GetMapping("/simulator")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<AlseDtos.SimulatorView> simulator() {
        return ResponseEntity.ok(alseService.simulate());
    }
}