package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payloads backing the four role dashboards. Every figure is derived from rows
 * in the database by {@code AnalyticsService} — none of it is hard-coded.
 */
public final class DashboardDtos {

    private DashboardDtos() {
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentDashboard {
        private Double gpa;
        private Integer attendance;
        private Integer engagementScore;
        private Integer assignmentProgress;
        private Integer credits;
        private Integer creditTarget;
        private String currentLearningState;
        private Integer stateConfidence;
        private Integer totalCourses;
        private Integer completedCourses;
        private Integer ongoingCourses;
        private Double gpaChange;
        private Double attendanceChange;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeacherDashboard {
        private Integer totalStudents;
        private Integer activeClasses;
        private Integer avgEngagement;
        private Integer attendanceRate;
        private Integer pendingAssignments;
        private Integer coursesManaged;
        private Integer reportsGenerated;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ParentDashboard {
        private Long childId;
        private String childName;
        private String childGrade;
        private Integer attendance;
        private Integer performance;
        private Integer engagement;
        private Integer assignmentCompletion;
        private Integer quizPerformance;
        private String summary;
        private String summaryTone;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminDashboard {
        private Long totalStudents;
        private Long totalTeachers;
        private Integer departments;
        private Long activeCourses;
        private Long onlineClasses;
        private Integer avgEngagement;
        private Double systemUptime;
        private Integer storageUsed;
        private Integer cpuUsage;
        private Integer memoryUsage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EngagementBreakdown {
        private Integer attendance;
        private Integer participation;
        private Integer assignments;
        private Integer quizPerformance;
        private Integer courseProgress;
        private Integer classroomEngagement;
        private Integer overallScore;
        private String percentileLabel;
        private String headline;
        private String narrative;
        private List<Insight> insights;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Insight {
        private String title;
        private String text;
        /** positive | warning | neutral */
        private String type;
    }
}