package com.lms.controller;

import com.lms.dto.AlertDto;
import com.lms.dto.AttentionPayloadDto;
import com.lms.model.AttentionLog;
import com.lms.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monitoring")
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;

    /**
     * The student is taken from the authenticated principal. Any studentId in the
     * body is ignored — previously it was trusted, which let any signed-in user
     * write attention telemetry against any other student.
     */
    @PostMapping("/attention")
    public ResponseEntity<AttentionLog> logAttention(@RequestBody AttentionPayloadDto dto,
                                                     @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        AttentionLog saved = monitoringService.recordAttention(dto, principal.getUsername());
        return saved == null ? ResponseEntity.badRequest().build() : ResponseEntity.ok(saved);
    }

    @GetMapping("/logs/{sessionId}")
    public ResponseEntity<List<AttentionLog>> getAttentionLogs(@PathVariable Long sessionId, @RequestParam(defaultValue = "CLASSROOM") String contextType) {
        return ResponseEntity.ok(monitoringService.getAttentionLogs(sessionId, contextType));
    }

    @GetMapping("/alerts/{sessionId}")
    public ResponseEntity<List<AlertDto>> getAlerts(@PathVariable Long sessionId, @RequestParam(defaultValue = "CLASSROOM") String contextType) {
        return ResponseEntity.ok(monitoringService.getAlerts(sessionId, contextType));
    }

    @GetMapping("/alerts/all")
    public ResponseEntity<List<AlertDto>> getAllAlerts() {
        return ResponseEntity.ok(monitoringService.getAllAlerts());
    }
}
