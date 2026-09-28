package com.lms.controller;

import com.lms.dto.AcademicDtos;
import com.lms.model.User;
import com.lms.security.CurrentUser;
import com.lms.service.AcademicService;
import com.lms.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Campus events, notifications, the credits wallet and the student's exam list.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CampusController {

    private final AcademicService academicService;
    private final NotificationService notificationService;
    private final CurrentUser currentUser;

    @GetMapping("/events")
    public ResponseEntity<List<AcademicDtos.EventCard>> events() {
        return ResponseEntity.ok(academicService.upcomingEvents());
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<AcademicDtos.NotificationCard>> notifications(Authentication authentication) {
        return ResponseEntity.ok(notificationService.forUser(currentUser.require(authentication)));
    }

    @GetMapping("/notifications/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(Authentication authentication) {
        long count = notificationService.unreadCount(currentUser.require(authentication));
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, Authentication authentication) {
        notificationService.markRead(id, currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<Void> markAllRead(Authentication authentication) {
        notificationService.markAllRead(currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/credits/my")
    public ResponseEntity<AcademicDtos.CreditsWallet> credits(Authentication authentication,
                                                              @RequestParam(required = false) Long studentId) {
        User student = currentUser.subjectStudent(authentication, studentId);
        return ResponseEntity.ok(academicService.creditsWallet(student));
    }

    @GetMapping("/exams/my-exams")
    public ResponseEntity<List<AcademicDtos.ExamCard>> exams(Authentication authentication,
                                                             @RequestParam(required = false) Long studentId) {
        User student = currentUser.subjectStudent(authentication, studentId);
        return ResponseEntity.ok(academicService.examsForStudent(student));
    }
}