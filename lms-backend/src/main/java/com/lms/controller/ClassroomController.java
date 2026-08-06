package com.lms.controller;

import com.lms.model.ChatMessage;
import com.lms.model.ClassroomSession;
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

    @GetMapping("/{id}/chat")
    public ResponseEntity<List<ChatMessage>> getChatHistory(@PathVariable Long id) {
        return ResponseEntity.ok(classroomService.getChatHistory(id));
    }

    @PostMapping("/{id}/chat")
    public ResponseEntity<ChatMessage> postChatMessage(@PathVariable Long id, @RequestBody ChatRequest request, Authentication authentication) {
        return ResponseEntity.ok(classroomService.saveChatMessage(id, authentication.getName(), request.getContent()));
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
