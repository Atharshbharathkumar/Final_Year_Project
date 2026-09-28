package com.lms.controller;

import com.lms.dto.AnalyticsDtos;
import com.lms.model.User;
import com.lms.repository.UserRepository;
import com.lms.security.CurrentUser;
import com.lms.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analytics;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    /**
     * Seven-day trend. Teachers and admins see their cohort; students and
     * guardians see the single student's own readings.
     */
    @GetMapping("/weekly")
    public ResponseEntity<List<AnalyticsDtos.TrendPoint>> weekly(Authentication authentication) {
        User caller = currentUser.require(authentication);
        List<User> scope = switch (caller.getRole()) {
            case TEACHER -> analytics.studentsOf(caller);
            case ADMIN -> userRepository.findByRole(User.Role.STUDENT);
            case PARENT -> List.of(currentUser.subjectStudent(authentication));
            case STUDENT -> List.of(caller);
        };
        return ResponseEntity.ok(analytics.weeklyTrend(scope));
    }

    @GetMapping("/monthly")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AnalyticsDtos.MonthlyPoint>> monthly() {
        return ResponseEntity.ok(analytics.monthlyTrend());
    }

    @GetMapping("/departments")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AnalyticsDtos.DepartmentStats>> departments() {
        return ResponseEntity.ok(analytics.departmentStats());
    }

    /** The teacher's student roster with live engagement and risk banding. */
    @GetMapping("/roster")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<List<AnalyticsDtos.RosterEntry>> roster(Authentication authentication) {
        User caller = currentUser.require(authentication);
        List<User> students = caller.getRole() == User.Role.ADMIN
                ? userRepository.findByRole(User.Role.STUDENT)
                : analytics.studentsOf(caller);
        return ResponseEntity.ok(analytics.roster(students));
    }
}