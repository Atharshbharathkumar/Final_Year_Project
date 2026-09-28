package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ResumeDtos {

    private ResumeDtos() {
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnalyzeRequest {
        private String fileName;
        /** Plain-text contents of the resume extracted in the browser. */
        private String text;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SectionScore {
        private Integer score;
        private String feedback;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IndustryMatch {
        private String industry;
        private Integer match;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResumeResult {
        private Long id;
        private String fileName;
        private Integer overallScore;
        private String verdict;
        private String analyzedAt;
        @Builder.Default
        private Map<String, SectionScore> breakdown = new LinkedHashMap<>();
        private List<String> suggestions;
        private List<IndustryMatch> industryMatch;
    }
}