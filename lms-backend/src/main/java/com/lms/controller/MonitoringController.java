package com.lms.controller;

import com.lms.dto.AlertDto;
import com.lms.dto.AttentionPayloadDto;
import com.lms.model.AttentionLog;
import com.lms.security.CurrentUser;
import com.lms.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monitoring")
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;
    private final CurrentUser currentUser;

    /**
     * Accepts one proctoring reading from the candidate's own browser. The
     * reading is attributed to the authenticated caller — any studentId in the
     * body is ignored.
     */
    @PostMapping("/attention")
    public ResponseEntity<AttentionLog> logAttention(@RequestBody AttentionPayloadDto dto,
                                                     Authentication authentication) {
        return ResponseEntity.ok(monitoringService.recordAttention(dto, currentUser.require(authentication)));
    }

    @GetMapping("/logs/{sessionId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AttentionLog>> getAttentionLogs(
            @PathVariable Long sessionId,
            @RequestParam(defaultValue = "CLASSROOM") String contextType) {
        return ResponseEntity.ok(monitoringService.getAttentionLogs(sessionId, contextType));
    }

    @GetMapping("/alerts/{sessionId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AlertDto>> getAlerts(
            @PathVariable Long sessionId,
            @RequestParam(defaultValue = "CLASSROOM") String contextType) {
        return ResponseEntity.ok(monitoringService.getAlerts(sessionId, contextType));
    }

    /** Invigilator feed — every alert names a student, so it is staff only. */
    @GetMapping("/alerts/all")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AlertDto>> getAllAlerts() {
        return ResponseEntity.ok(monitoringService.getAllAlerts());
    }
}
