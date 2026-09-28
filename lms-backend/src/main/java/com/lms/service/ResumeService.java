package com.lms.service;

import com.lms.dto.ResumeDtos;
import com.lms.model.ResumeAnalysis;
import com.lms.model.User;
import com.lms.repository.ResumeAnalysisRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Scores an uploaded resume by actually reading its text: section coverage,
 * keyword density, quantified impact and action-verb usage. Every score is a
 * function of the submitted content, so editing the resume changes the result.
 */
@Service
@RequiredArgsConstructor
public class ResumeService {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");
    private static final Pattern NUMBER = Pattern.compile("\\d+([.,]\\d+)?\\s*(%|x|k\\b|million|users|hours|ms|seconds)?");
    private static final Pattern BULLET = Pattern.compile("(?m)^\\s*[-*•▪]\\s+.*$");

    private static final List<String> SECTIONS = List.of(
            "experience", "education", "skills", "project", "summary", "contact");

    private static final List<String> ACTION_VERBS = List.of(
            "led", "architected", "optimized", "optimised", "designed", "built", "developed",
            "implemented", "spearheaded", "delivered", "improved", "reduced", "automated",
            "migrated", "scaled", "launched", "mentored", "owned", "shipped");

    private static final List<String> ATS_KEYWORDS = List.of(
            "rest api", "ci/cd", "agile", "cloud", "docker", "kubernetes", "sql", "git",
            "testing", "microservices", "scrum", "linux", "security");

    private static final Map<String, List<String>> INDUSTRY_KEYWORDS = new LinkedHashMap<>() {{
        put("Software Development", List.of("java", "spring", "api", "git", "testing", "oop", "backend", "microservices"));
        put("Data Science", List.of("python", "pandas", "numpy", "statistics", "sql", "visualisation", "visualization", "regression"));
        put("Cloud Engineering", List.of("aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "linux"));
        put("Full Stack Development", List.of("react", "node", "javascript", "css", "rest api", "database", "frontend", "backend"));
        put("AI/ML Engineering", List.of("machine learning", "tensorflow", "pytorch", "neural", "model", "nlp", "computer vision", "training"));
    }};

    private final ResumeAnalysisRepository resumeRepository;

    @Transactional
    public ResumeDtos.ResumeResult analyze(User student, String fileName, String text) {
        String content = text == null ? "" : text;
        String lower = content.toLowerCase(Locale.ENGLISH);
        int wordCount = content.isBlank() ? 0 : content.trim().split("\\s+").length;

        int formatting = scoreFormatting(content, lower, wordCount);
        int skills = scoreSkills(lower);
        int experience = scoreExperience(lower, content);
        int education = scoreEducation(lower);
        int keywords = scoreKeywords(lower);
        int impact = scoreImpact(content);

        // Weighted toward the sections recruiters and ATS filters weigh most.
        int overall = (int) Math.round(
                formatting * 0.15 + skills * 0.20 + experience * 0.22
                        + education * 0.13 + keywords * 0.18 + impact * 0.12);

        ResumeAnalysis saved = resumeRepository.save(ResumeAnalysis.builder()
                .student(student)
                .fileName(fileName == null || fileName.isBlank() ? "resume.pdf" : fileName)
                .overallScore(overall)
                .formattingScore(formatting)
                .skillsScore(skills)
                .experienceScore(experience)
                .educationScore(education)
                .keywordsScore(keywords)
                .impactScore(impact)
                .suggestions(String.join("\n", buildSuggestions(lower, content, formatting, skills, experience, keywords, impact, wordCount)))
                .industryMatches(serialiseMatches(lower))
                .extractedText(content.length() > 19_000 ? content.substring(0, 19_000) : content)
                .build());

        return toResult(saved);
    }

    public Optional<ResumeDtos.ResumeResult> latest(User student) {
        return resumeRepository.findFirstByStudentOrderByAnalyzedAtDesc(student).map(this::toResult);
    }

    // ─────────────────────────────── scoring ──────────────────────────────────

    private int scoreFormatting(String content, String lower, int wordCount) {
        int score = 40;
        long sectionsPresent = SECTIONS.stream().filter(lower::contains).count();
        score += (int) (sectionsPresent * 8);                      // up to +48
        if (BULLET.matcher(content).find()) score += 8;
        if (wordCount >= 250 && wordCount <= 900) score += 6;      // sensible one-to-two pages
        else if (wordCount > 1200) score -= 10;
        return clamp(score);
    }

    private int scoreSkills(String lower) {
        long hits = INDUSTRY_KEYWORDS.values().stream()
                .flatMap(List::stream)
                .distinct()
                .filter(lower::contains)
                .count();
        return clamp((int) (35 + hits * 4));
    }

    private int scoreExperience(String lower, String content) {
        long verbs = ACTION_VERBS.stream().filter(lower::contains).count();
        long bullets = BULLET.matcher(content).results().count();
        int score = 35 + (int) (verbs * 5) + (int) Math.min(20, bullets * 2);
        if (lower.contains("intern") || lower.contains("experience")) score += 6;
        return clamp(score);
    }

    private int scoreEducation(String lower) {
        int score = 45;
        if (lower.contains("b.tech") || lower.contains("bachelor") || lower.contains("b.e.")) score += 20;
        if (lower.contains("university") || lower.contains("college") || lower.contains("institute")) score += 12;
        if (lower.contains("gpa") || lower.contains("cgpa") || lower.contains("percentage")) score += 13;
        if (lower.contains("coursework")) score += 8;
        return clamp(score);
    }

    private int scoreKeywords(String lower) {
        long hits = ATS_KEYWORDS.stream().filter(lower::contains).count();
        return clamp((int) (30 + (100.0 * hits / ATS_KEYWORDS.size()) * 0.7));
    }

    private int scoreImpact(String content) {
        List<String> bullets = BULLET.matcher(content).results().map(r -> r.group()).toList();
        if (bullets.isEmpty()) {
            return NUMBER.matcher(content).find() ? 55 : 35;
        }
        long quantified = bullets.stream().filter(b -> NUMBER.matcher(b).find()).count();
        return clamp((int) (35 + 65.0 * quantified / bullets.size()));
    }

    private List<String> buildSuggestions(String lower, String content, int formatting, int skills,
                                          int experience, int keywords, int impact, int wordCount) {
        List<String> out = new ArrayList<>();

        List<String> missingSections = SECTIONS.stream().filter(s -> !lower.contains(s)).toList();
        if (!missingSections.isEmpty()) {
            out.add("Add the missing section(s): " + String.join(", ", missingSections) + ".");
        }
        if (!lower.contains("summary")) {
            out.add("Add a professional summary at the top highlighting your key strengths.");
        }

        List<String> missingKeywords = ATS_KEYWORDS.stream().filter(k -> !lower.contains(k)).limit(5).toList();
        if (!missingKeywords.isEmpty()) {
            out.add("Include ATS keywords you are missing: " + String.join(", ", missingKeywords) + ".");
        }
        if (impact < 75) {
            out.add("Quantify your achievements — only some bullet points contain measurable numbers.");
        }
        if (experience < 75) {
            out.add("Use stronger action verbs such as Led, Architected, Optimized, Spearheaded.");
        }
        if (!lower.contains("github") && !lower.contains("linkedin") && !lower.contains("portfolio")) {
            out.add("Add links to your portfolio, GitHub, or LinkedIn profile.");
        }
        if (wordCount > 900) {
            out.add("Trim to one page for entry-level roles — the document currently runs to " + wordCount + " words.");
        }
        if (skills < 70) {
            out.add("Expand the skills section with the specific tools and frameworks you have used.");
        }
        if (out.isEmpty()) {
            out.add("Strong resume — keep it current and tailor the summary per application.");
        }
        return out;
    }

    private String serialiseMatches(String lower) {
        StringBuilder sb = new StringBuilder();
        INDUSTRY_KEYWORDS.forEach((industry, words) -> {
            long hits = words.stream().filter(lower::contains).count();
            int match = clamp((int) Math.round(25 + 75.0 * hits / words.size()));
            sb.append(industry).append('=').append(match).append('\n');
        });
        return sb.toString().trim();
    }

    private ResumeDtos.ResumeResult toResult(ResumeAnalysis a) {
        Map<String, ResumeDtos.SectionScore> breakdown = new LinkedHashMap<>();
        breakdown.put("formatting", section(a.getFormattingScore(),
                "Section coverage, bullet structure and overall length."));
        breakdown.put("skills", section(a.getSkillsScore(),
                "Breadth of recognised tools and technologies detected in the document."));
        breakdown.put("experience", section(a.getExperienceScore(),
                "Action-verb usage and the depth of described responsibilities."));
        breakdown.put("education", section(a.getEducationScore(),
                "Degree, institution, grade and relevant coursework detail."));
        breakdown.put("keywords", section(a.getKeywordsScore(),
                "Coverage of the ATS keyword set recruiters filter on."));
        breakdown.put("impact", section(a.getImpactScore(),
                "Share of bullet points that carry a measurable outcome."));

        List<ResumeDtos.IndustryMatch> matches = new ArrayList<>();
        if (a.getIndustryMatches() != null) {
            for (String line : a.getIndustryMatches().split("\n")) {
                String[] parts = line.split("=");
                if (parts.length == 2) {
                    matches.add(ResumeDtos.IndustryMatch.builder()
                            .industry(parts[0])
                            .match(Integer.parseInt(parts[1].trim()))
                            .build());
                }
            }
        }

        int score = a.getOverallScore() == null ? 0 : a.getOverallScore();
        String verdict;
        if (score >= 85) verdict = "Excellent — ready for top-tier applications.";
        else if (score >= 70) verdict = "Good, but needs improvement for top-tier roles.";
        else if (score >= 55) verdict = "Average — several sections need strengthening.";
        else verdict = "Needs significant work before applying.";

        return ResumeDtos.ResumeResult.builder()
                .id(a.getId())
                .fileName(a.getFileName())
                .overallScore(score)
                .verdict(verdict)
                .analyzedAt(a.getAnalyzedAt() != null ? a.getAnalyzedAt().format(STAMP) : null)
                .breakdown(breakdown)
                .suggestions(a.getSuggestions() == null || a.getSuggestions().isBlank()
                        ? List.of() : Arrays.asList(a.getSuggestions().split("\n")))
                .industryMatch(matches)
                .build();
    }

    private ResumeDtos.SectionScore section(Integer score, String feedback) {
        return ResumeDtos.SectionScore.builder()
                .score(score == null ? 0 : score)
                .feedback(feedback)
                .build();
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }
}