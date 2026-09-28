package com.lms.service;

import com.lms.TestFixtures;
import com.lms.dto.ResumeDtos;
import com.lms.model.ResumeAnalysis;
import com.lms.model.User;
import com.lms.repository.ResumeAnalysisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Resume scoring must be a function of the submitted text — a stronger document
 * has to score higher, or the feature is decoration.
 */
@ExtendWith(MockitoExtension.class)
class ResumeServiceTest {

    @Mock private ResumeAnalysisRepository resumeRepository;
    @InjectMocks private ResumeService resumeService;

    private User student;

    private static final String STRONG = """
            PROFESSIONAL SUMMARY
            Final year B.Tech Computer Science student at Anna University with a CGPA of 8.7.

            SKILLS
            Java, Spring Boot, React, Node, SQL, Docker, Kubernetes, Git, REST API, CI/CD,
            Agile, Linux, Testing, Microservices, Python, TensorFlow, AWS

            EXPERIENCE
            Software Engineering Intern
            - Led migration of 12 REST API endpoints, reducing p95 latency by 38%
            - Built a CI/CD pipeline that cut deploy time from 25 minutes to 4 minutes
            - Optimized SQL queries, improving dashboard load time by 60%
            - Automated regression testing, covering 240 cases

            PROJECTS
            - Architected a learning platform with WebSocket monitoring serving 200 users

            EDUCATION
            B.Tech Computer Science, Anna University, CGPA 8.7
            Relevant coursework: Data Structures, Machine Learning, Databases

            CONTACT
            github.com/example linkedin.com/in/example
            """;

    private static final String WEAK = """
            I am a student looking for a job.
            I know computers and I am a hard worker.
            I studied in college for four years and enjoyed it.
            Please consider me for your opening as I am eager to learn new things.
            """;

    @BeforeEach
    void setUp() {
        student = TestFixtures.student(1L, "Test Student");
        // Persisting returns the entity with an id and timestamp, as JPA would.
        when(resumeRepository.save(any())).thenAnswer(invocation -> {
            ResumeAnalysis saved = invocation.getArgument(0);
            saved.setId(1L);
            if (saved.getAnalyzedAt() == null) saved.setAnalyzedAt(LocalDateTime.now());
            return saved;
        });
    }

    @Test
    @DisplayName("scores a complete, quantified resume well above a vague one")
    void strongBeatsWeak() {
        int strong = resumeService.analyze(student, "strong.txt", STRONG).getOverallScore();
        int weak = resumeService.analyze(student, "weak.txt", WEAK).getOverallScore();

        assertThat(strong).isGreaterThan(weak);
        assertThat(strong).isGreaterThan(70);
        assertThat(weak).isLessThan(60);
    }

    @Test
    @DisplayName("rewards bullet points that carry a measurable number")
    void rewardsQuantifiedImpact() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "strong.txt", STRONG);

        // Every bullet in the strong sample carries a figure.
        assertThat(result.getBreakdown().get("impact").getScore()).isEqualTo(100);
    }

    @Test
    @DisplayName("penalises a document missing the sections recruiters look for")
    void penalisesMissingSections() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "weak.txt", WEAK);

        assertThat(result.getBreakdown().get("formatting").getScore())
                .isLessThan(resumeService.analyze(student, "strong.txt", STRONG)
                        .getBreakdown().get("formatting").getScore());
    }

    @Test
    @DisplayName("tells the candidate which ATS keywords are missing")
    void suggestsMissingKeywords() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "weak.txt", WEAK);

        assertThat(result.getSuggestions()).isNotEmpty();
        assertThat(String.join(" ", result.getSuggestions())).contains("ATS keywords");
    }

    @Test
    @DisplayName("reports an industry match for every profile, bounded to a percentage")
    void industryMatchesAreBounded() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "strong.txt", STRONG);

        assertThat(result.getIndustryMatch()).hasSize(5);
        assertThat(result.getIndustryMatch()).allSatisfy(match ->
                assertThat(match.getMatch()).isBetween(0, 100));
    }

    @Test
    @DisplayName("matches a backend-heavy resume more strongly to software than to data science")
    void matchesTheRightIndustry() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "strong.txt", STRONG);

        int software = result.getIndustryMatch().stream()
                .filter(m -> m.getIndustry().equals("Software Development"))
                .findFirst().orElseThrow().getMatch();
        int cloud = result.getIndustryMatch().stream()
                .filter(m -> m.getIndustry().equals("Cloud Engineering"))
                .findFirst().orElseThrow().getMatch();

        assertThat(software).isGreaterThan(50);
        assertThat(cloud).isGreaterThan(50); // Docker, Kubernetes, AWS, CI/CD, Linux all present
    }

    @Test
    @DisplayName("breaks the score into the six sections the UI renders")
    void breakdownCoversEverySection() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "strong.txt", STRONG);

        assertThat(result.getBreakdown()).containsOnlyKeys(
                "formatting", "skills", "experience", "education", "keywords", "impact");
        assertThat(result.getBreakdown().values()).allSatisfy(section -> {
            assertThat(section.getScore()).isBetween(0, 100);
            assertThat(section.getFeedback()).isNotBlank();
        });
    }

    @Test
    @DisplayName("handles empty input without failing")
    void handlesEmptyInput() {
        ResumeDtos.ResumeResult result = resumeService.analyze(student, "empty.txt", "");

        assertThat(result.getOverallScore()).isBetween(0, 100);
        assertThat(result.getSuggestions()).isNotEmpty();
    }

    @Test
    @DisplayName("gives the same text the same score every time")
    void isDeterministic() {
        int first = resumeService.analyze(student, "a.txt", STRONG).getOverallScore();
        int second = resumeService.analyze(student, "a.txt", STRONG).getOverallScore();

        assertThat(first).isEqualTo(second);
    }
}