package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Payloads for the Adaptive Learning State Engine screens. */
public final class AlseDtos {

    private AlseDtos() {
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StateTimelineEntry {
        private String time;
        private String state;
        /** positive | warning | danger | brand */
        private String type;
        private String evidence;
        private Integer confidence;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CurrentState {
        private String state;
        private String type;
        private Integer confidence;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LearningStateView {
        private Long studentId;
        private String studentName;
        private CurrentState current;
        private List<StateTimelineEntry> timeline;
        private ExplainableScore explainableScore;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExplainableScore {
        private Integer total;
        private List<ScoreFactor> breakdown;
        private String improvementArea;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreFactor {
        private String factor;
        private Integer impact;
        private Integer max;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StateSlice {
        private String name;
        private Integer value;
        private String color;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DigitalTwin {
        private Long studentId;
        private String student;
        private String cohort;
        private List<StateSlice> stateDistribution;
        private StateSlice dominantState;
        private Characteristics characteristics;
        private ExplainableScore explainableScore;
        private Integer interventionSuccessRate;
        private Integer interventionsObserved;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Characteristics {
        private String bestPerformance;
        private String difficulty;
        private String strongest;
        private String weakest;
        private String peakLearning;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InterventionView {
        private Long id;
        private Long studentId;
        private String student;
        private String currentState;
        private List<String> evidence;
        private String recommendation;
        private String objective;
        /** Pending | Approved | Rejected | Delivered */
        private String status;
        private Outcome outcome;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Outcome {
        /** Positive | Neutral | Negative */
        private String status;
        private String improvement;
        private String metric;
        private String resultingState;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InterventionSummary {
        private Long atRisk;
        private Long pending;
        private Integer averageImprovement;
        private List<InterventionView> interventions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Scenario {
        private String id;
        private String name;
        private String impact;
        private String assessment;
        private Integer target;
        private Integer result;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SimulatorView {
        private Integer currentStruggling;
        private Integer baselineEngagement;
        private List<Scenario> scenarios;
    }
}