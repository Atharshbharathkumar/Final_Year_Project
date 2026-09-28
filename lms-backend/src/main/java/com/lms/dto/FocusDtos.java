package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Focus enforcement during a live class.
 * <p>
 * The browser can tell us that the student left our window, or stopped sharing
 * their screen. It cannot tell us <em>which</em> application they moved to, and
 * it cannot close it — so enforcement here means escalating warnings, alerting
 * the teacher, and ultimately removing the student from the room.
 */
public final class FocusDtos {

    private FocusDtos() {
    }

    /** What the browser observed. */
    public enum EventType {
        /** The class window lost focus — the student is in another app or tab. */
        WINDOW_BLUR,
        /** The student ended the screen share while the class was running. */
        SCREEN_SHARE_STOPPED,
        /** The student came back to the class window. */
        RETURNED
    }

    /** How the platform responds, based on how many times it has happened. */
    public enum Enforcement {
        /** Nothing to do — a return, or the first observation. */
        NONE,
        /** First strike: block the class content until they come back. */
        WARN,
        /** Second strike: same block, and the teacher is told. */
        FINAL_WARNING,
        /** Limit reached: the student is removed from the session. */
        REMOVED
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FocusEventRequest {
        private EventType type;
        /** Seconds the student spent away, when the client can measure it. */
        private Integer awaySeconds;
    }

    /** One student's focus record, as the host teacher sees it. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentStanding {
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private String avatar;
        private Integer violations;
        private Integer limit;
        private Boolean removed;
        private String lastEvent;
        private String lastEventAt;
        /** Strikes previously forgiven by a teacher. */
        private Integer forgiven;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FocusEventResponse {
        private Integer violations;
        private Integer limit;
        private Enforcement action;
        private String message;
        /** True once the student may no longer participate in this session. */
        private Boolean removed;
    }
}
