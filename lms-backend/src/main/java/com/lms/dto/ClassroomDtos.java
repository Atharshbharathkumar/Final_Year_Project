package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public final class ClassroomDtos {

    private ClassroomDtos() {
    }

    /**
     * A live participant view assembled from the newest attention log each
     * enrolled student has produced for the running session.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Participant {
        private Long id;
        private String name;
        /** focused | active | attention-shift | away | not-detected */
        private String status;
        private Boolean faceDetected;
        private String gazeDirection;
        private String headPose;
        private String expression;
        private Boolean verified;
        private Integer attentionScore;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClassInfo {
        private Long sessionId;
        private String title;
        private String subject;
        private String courseCode;
        private String topic;
        private String teacher;
        private String duration;
        private Integer attendees;
        private Integer total;
        private Boolean active;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScreenActivity {
        private Integer courseRelated;
        private Integer otherActivity;
        private Integer tabSwitching;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LiveAnalysis {
        private Integer overallFocus;
        private Integer participation;
        private String participationLabel;
        private Integer faceVerified;
        private Integer attentionShifts;
        private Integer awayFromFrame;
        private Integer avgFocusMinutes;
        private Integer sessionMinutes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LiveClassroom {
        private ClassInfo classInfo;
        private List<Participant> participants;
        private ScreenActivity screenActivity;
        private LiveAnalysis analysis;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatEntry {
        private Long id;
        private Long senderId;
        private String sender;
        private String role;
        private String content;
        private String time;
    }
}