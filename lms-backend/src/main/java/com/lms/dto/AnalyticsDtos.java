package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    /** One point on the rolling engagement chart. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendPoint {
        private String day;
        private Integer engagement;
        private Integer attendance;
        private Integer participation;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyPoint {
        private String month;
        private Long students;
        private Integer engagement;
        private Integer attendance;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DepartmentStats {
        private String name;
        private String code;
        private Long students;
        private Long teachers;
        private Long courses;
        private Integer avgEngagement;
    }

    /** A row of the teacher's student roster. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RosterEntry {
        private Long id;
        private String name;
        private String email;
        private String department;
        private Integer year;
        private Double gpa;
        private Integer engagement;
        private Integer attendance;
        private String status;
        private String avatar;
        /** low | medium | high */
        private String risk;
    }

    /** Automated post-session report. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionReport {
        private Long sessionId;
        private String sessionTitle;
        private String courseName;
        private String courseCode;
        private String teacherName;
        private String date;
        private Integer attendees;
        private Integer totalStudents;
        private Integer overallEngagement;
        private Integer classAverage;
        private Integer avgFocusMinutes;
        private Integer sessionMinutes;
        private Integer screenCourseRelated;
        private List<DashboardDtos.Insight> insights;
        private String disclaimer;
    }
}