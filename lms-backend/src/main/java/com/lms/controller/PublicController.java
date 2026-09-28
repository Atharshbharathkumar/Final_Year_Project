package com.lms.controller;

import com.lms.model.User;
import com.lms.repository.CourseRepository;
import com.lms.repository.UserRepository;
import com.lms.service.AnalyticsService;
import com.lms.service.DashboardService;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Unauthenticated platform figures for the landing and login pages.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final AnalyticsService analytics;
    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public ResponseEntity<PlatformStats> stats() {
        return ResponseEntity.ok(PlatformStats.builder()
                .students(userRepository.countByRole(User.Role.STUDENT))
                .teachers(userRepository.countByRole(User.Role.TEACHER))
                .courses(courseRepository.count())
                .avgEngagement(analytics.platformEngagement())
                .attendanceRate(analytics.platformAttendance())
                .liveClasses(analytics.activeSessionCount())
                .systemUptime(dashboardService.adminDashboard().getSystemUptime())
                .build());
    }

    @Data
    @Builder
    @AllArgsConstructor
    public static class PlatformStats {
        private Long students;
        private Long teachers;
        private Long courses;
        private Integer avgEngagement;
        private Integer attendanceRate;
        private Long liveClasses;
        private Double systemUptime;
    }
}