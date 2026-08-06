package com.lms.controller;

import com.lms.model.AttendanceRecord;
import com.lms.model.User;
import com.lms.service.AccessGuard;
import com.lms.service.AttendanceService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final AccessGuard accessGuard;

    private User caller(UserDetails principal) {
        return accessGuard.requireUser(principal.getUsername());
    }

    /** Own records for a student; a parent or teacher may pass a studentId. */
    @GetMapping("/student/{studentId}")
    public ResponseEntity<List<AttendanceRecord>> forStudent(@PathVariable Long studentId,
                                                             @AuthenticationPrincipal UserDetails principal) {
        User student = accessGuard.requireStudent(studentId);
        return ResponseEntity.ok(attendanceService.getForStudent(student, caller(principal)));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<AttendanceRecord>> mine(@AuthenticationPrincipal UserDetails principal) {
        User me = caller(principal);
        return ResponseEntity.ok(attendanceService.getForStudent(me, me));
    }

    @GetMapping("/summary/{studentId}")
    public ResponseEntity<AttendanceService.AttendanceSummary> summary(@PathVariable Long studentId,
                                                                       @AuthenticationPrincipal UserDetails principal) {
        User student = accessGuard.requireStudent(studentId);
        return ResponseEntity.ok(attendanceService.summarise(student, caller(principal)));
    }

    @GetMapping("/register/{courseId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<List<AttendanceRecord>> register(
            @PathVariable Long courseId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(attendanceService.getRegister(courseId, date, caller(principal)));
    }

    @PostMapping("/mark")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<AttendanceRecord> mark(@RequestBody MarkRequest request,
                                                 @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(attendanceService.mark(
                request.getStudentId(), request.getCourseId(),
                request.getDate() != null ? request.getDate() : LocalDate.now(),
                request.getStatus(), caller(principal)));
    }

    /** Derives the register for a session from recorded attention samples. */
    @PostMapping("/auto-mark")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<AttendanceService.AutoMarkResult> autoMark(@RequestBody AutoMarkRequest request,
                                                                     @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(attendanceService.autoMarkFromSession(
                request.getCourseId(), request.getSessionId(),
                request.getDate() != null ? request.getDate() : LocalDate.now(),
                caller(principal)));
    }

    @Data
    public static class MarkRequest {
        private Long studentId;
        private Long courseId;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate date;
        private AttendanceRecord.Status status;
    }

    @Data
    public static class AutoMarkRequest {
        private Long courseId;
        private Long sessionId;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate date;
    }
}
