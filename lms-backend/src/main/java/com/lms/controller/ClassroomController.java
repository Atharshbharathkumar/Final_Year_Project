package com.lms.controller;

import com.lms.dto.AnalyticsDtos;
import com.lms.dto.ClassroomDtos;
import com.lms.dto.FocusDtos;
import com.lms.model.ChatMessage;
import com.lms.model.ClassroomSession;
import com.lms.security.CurrentUser;
import com.lms.service.ClassroomInsightService;
import com.lms.service.ClassroomService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classroom")
@RequiredArgsConstructor
public class ClassroomController {

    private final ClassroomService classroomService;
    private final ClassroomInsightService insightService;
    private final CurrentUser currentUser;

    /**
     * The live participant grid, screen-activity split and focus analysis for the
     * running session (or the given one).
     */
    @GetMapping("/live")
    public ResponseEntity<ClassroomDtos.LiveClassroom> live(@RequestParam(required = false) Long sessionId) {
        return ResponseEntity.ok(insightService.liveClassroom(sessionId));
    }

    /** Automated post-session engagement report. */
    @GetMapping("/report")
    public ResponseEntity<AnalyticsDtos.SessionReport> report(@RequestParam(required = false) Long sessionId) {
        return ResponseEntity.ok(insightService.sessionReport(sessionId));
    }

    @GetMapping("/active")
    public ResponseEntity<List<ClassroomSession>> getActiveSessions() {
        return ResponseEntity.ok(classroomService.getActiveSessions());
    }

    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<ClassroomSession>> getSessionsByCourse(@PathVariable Long courseId) {
        return ResponseEntity.ok(classroomService.getSessionsByCourse(courseId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassroomSession> getSessionById(@PathVariable Long id) {
        return ResponseEntity.ok(classroomService.getSessionById(id));
    }

    @PostMapping("/create")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<ClassroomSession> createSession(@RequestBody CreateSessionRequest request, Authentication authentication) {
        return ResponseEntity.ok(classroomService.createSession(request.getTitle(), request.getCourseId(), authentication.getName()));
    }

    @PostMapping("/{id}/end")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<ClassroomSession> endSession(@PathVariable Long id) {
        return ResponseEntity.ok(classroomService.endSession(id));
    }

    /**
     * Reports that the student left the class window or stopped sharing, and
     * returns what the platform is doing about it. The violation count is kept
     * server-side so it cannot be reset by the client.
     */
    @PostMapping("/{id}/focus-event")
    public ResponseEntity<FocusDtos.FocusEventResponse> focusEvent(
            @PathVariable Long id,
            @RequestBody FocusDtos.FocusEventRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(classroomService.recordFocusEvent(
                id, currentUser.require(authentication), request));
    }

    /** Whether this student has already used up their focus allowance. */
    @GetMapping("/{id}/my-standing")
    public ResponseEntity<FocusDtos.FocusEventResponse> myStanding(@PathVariable Long id,
                                                                   Authentication authentication) {
        return ResponseEntity.ok(classroomService.recordFocusEvent(
                id, currentUser.require(authentication),
                new FocusDtos.FocusEventRequest(FocusDtos.EventType.RETURNED, null)));
    }

    /** Focus standings for the host teacher: who has strikes, and who is out. */
    @GetMapping("/{id}/standings")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<FocusDtos.StudentStanding>> standings(@PathVariable Long id,
                                                                     Authentication authentication) {
        return ResponseEntity.ok(classroomService.focusStandings(id, currentUser.require(authentication)));
    }

    /** Clears a student's strikes so they can rejoin the running session. */
    @PostMapping("/{id}/readmit/{studentId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<FocusDtos.StudentStanding> readmit(@PathVariable Long id,
                                                             @PathVariable Long studentId,
                                                             Authentication authentication) {
        return ResponseEntity.ok(classroomService.readmitStudent(id, studentId, currentUser.require(authentication)));
    }

    @GetMapping("/{id}/chat")
    public ResponseEntity<List<ClassroomDtos.ChatEntry>> getChatHistory(@PathVariable Long id) {
        return ResponseEntity.ok(insightService.chat(classroomService.getSessionById(id)));
    }

    @PostMapping("/{id}/chat")
    public ResponseEntity<ClassroomDtos.ChatEntry> postChatMessage(@PathVariable Long id,
                                                                   @RequestBody ChatRequest request,
                                                                   Authentication authentication) {
        ChatMessage saved = classroomService.saveChatMessage(id, authentication.getName(), request.getContent());
        return ResponseEntity.ok(insightService.chat(saved.getSession()).stream()
                .filter(e -> e.getId().equals(saved.getId()))
                .findFirst()
                .orElseThrow());
    }

    @Data
    public static class CreateSessionRequest {
        private String title;
        private Long courseId;
    }

    @Data
    public static class ChatRequest {
        private String content;
    }
}