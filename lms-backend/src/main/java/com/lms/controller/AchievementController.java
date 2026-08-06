package com.lms.controller;

import com.lms.model.Achievement;
import com.lms.model.User;
import com.lms.service.AccessGuard;
import com.lms.service.AchievementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/achievements")
@RequiredArgsConstructor
public class AchievementController {

    private final AchievementService achievementService;
    private final AccessGuard accessGuard;

    private User caller(UserDetails principal) {
        return accessGuard.requireUser(principal.getUsername());
    }

    @GetMapping("/mine")
    public ResponseEntity<List<Achievement>> mine(@AuthenticationPrincipal UserDetails principal) {
        User me = caller(principal);
        return ResponseEntity.ok(achievementService.getForStudent(me, me));
    }

    @GetMapping("/student/{studentId}")
    public ResponseEntity<List<Achievement>> forStudent(@PathVariable Long studentId,
                                                        @AuthenticationPrincipal UserDetails principal) {
        User student = accessGuard.requireStudent(studentId);
        return ResponseEntity.ok(achievementService.getForStudent(student, caller(principal)));
    }

    @GetMapping("/summary/{studentId}")
    public ResponseEntity<AchievementService.AchievementSummary> summary(@PathVariable Long studentId,
                                                                         @AuthenticationPrincipal UserDetails principal) {
        User student = accessGuard.requireStudent(studentId);
        return ResponseEntity.ok(achievementService.summarise(student, caller(principal)));
    }

    @GetMapping
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<List<Achievement>> all(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(achievementService.getAll(caller(principal)));
    }

    @PostMapping("/student/{studentId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Achievement> award(@PathVariable Long studentId,
                                             @RequestBody Achievement achievement,
                                             @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(achievementService.award(studentId, achievement, caller(principal)));
    }

    @DeleteMapping("/{achievementId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long achievementId,
                                       @AuthenticationPrincipal UserDetails principal) {
        achievementService.delete(achievementId, caller(principal));
        return ResponseEntity.noContent().build();
    }
}
