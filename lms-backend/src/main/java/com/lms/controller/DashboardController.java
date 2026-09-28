package com.lms.controller;

import com.lms.dto.DashboardDtos;
import com.lms.model.User;
import com.lms.security.CurrentUser;
import com.lms.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final CurrentUser currentUser;

    @GetMapping("/student")
    public ResponseEntity<DashboardDtos.StudentDashboard> student(
            Authentication authentication,
            @RequestParam(required = false) Long studentId) {
        User student = currentUser.subjectStudent(authentication, studentId);
        return ResponseEntity.ok(dashboardService.studentDashboard(student));
    }

    @GetMapping("/teacher")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<DashboardDtos.TeacherDashboard> teacher(Authentication authentication) {
        return ResponseEntity.ok(dashboardService.teacherDashboard(currentUser.require(authentication)));
    }

    @GetMapping("/parent")
    public ResponseEntity<DashboardDtos.ParentDashboard> parent(Authentication authentication) {
        return ResponseEntity.ok(dashboardService.parentDashboard(currentUser.require(authentication)));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DashboardDtos.AdminDashboard> admin() {
        return ResponseEntity.ok(dashboardService.adminDashboard());
    }

    @GetMapping("/engagement-breakdown")
    public ResponseEntity<DashboardDtos.EngagementBreakdown> engagementBreakdown(
            Authentication authentication,
            @RequestParam(required = false) Long studentId) {
        User student = currentUser.subjectStudent(authentication, studentId);
        return ResponseEntity.ok(dashboardService.engagementBreakdown(student));
    }
}