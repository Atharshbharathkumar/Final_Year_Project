package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public final class AcademicDtos {

    private AcademicDtos() {
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CourseCard {
        private Long id;
        private String name;
        private String code;
        private String description;
        private String instructor;
        private Integer progress;
        private Long enrolled;
        private String grade;
        private String semester;
        private Integer credits;
        private String color;
        private String icon;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignmentCard {
        private Long id;
        private String title;
        private String course;
        private Long courseId;
        private String description;
        /** ISO yyyy-MM-dd, what the countdown widget parses. */
        private String dueDate;
        private String dueDateTime;
        /** pending | in-progress | submitted | graded */
        private String status;
        /** low | medium | high */
        private String priority;
        private Integer points;
        private Integer grade;
        private String feedback;
        private String submittedOn;
    }

    /** One student's submission as it appears in the teacher's grading queue. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubmissionCard {
        private Long id;
        private Long assignmentId;
        private String assignmentTitle;
        private String courseName;
        private String courseCode;
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private String studentAvatar;
        private String status;
        private Integer points;
        private Integer grade;
        private String feedback;
        private String fileName;
        private String submittedAt;
        private Boolean late;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GradeRequest {
        private Integer grade;
        private String feedback;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateAssignmentRequest {
        private Long courseId;
        private String title;
        private String description;
        /** ISO local date, e.g. 2026-09-01. */
        private String dueDate;
        private Integer points;
        /** LOW | MEDIUM | HIGH */
        private String priority;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateCourseRequest {
        private String title;
        private String courseCode;
        private String description;
        private String color;
        private String icon;
        private Integer creditHours;
        private String semester;
        private Integer totalSessions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventCard {
        private Long id;
        private String title;
        private String date;
        private String time;
        private String type;
        private Integer credits;
        private String location;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationCard {
        private Long id;
        private String title;
        private String message;
        /** Relative label such as "2 hours ago". */
        private String time;
        private String type;
        private Boolean read;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExamCard {
        private Long id;
        private String title;
        private String course;
        private String date;
        private String time;
        private String duration;
        private String type;
        /** upcoming | completed */
        private String status;
        private Integer score;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreditsWallet {
        private Integer total;
        private Integer target;
        private Integer level;
        private String levelLabel;
        private Integer remainingForHonors;
        private List<CreditCategory> categories;
        private List<Achievement> achievements;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreditCategory {
        private String name;
        private Integer earned;
        private Integer categoryMax;
        private String icon;
        private String color;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Achievement {
        private String title;
        private String date;
        private Integer credits;
        private String type;
    }
}