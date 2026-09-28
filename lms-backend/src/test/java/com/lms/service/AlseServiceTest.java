package com.lms.service;

import com.lms.TestFixtures;
import com.lms.dto.AlseDtos;
import com.lms.model.*;
import com.lms.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.OptionalInt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The learning-state engine turns raw attention readings into pedagogical
 * states. These tests pin every classification branch, because the states drive
 * the Digital Twin, the intervention queue and the simulator.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AlseServiceTest {

    @Mock private LearningStateLogRepository stateRepository;
    @Mock private AttentionLogRepository attentionLogRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private UserRepository userRepository;
    @Mock private SubmissionRepository submissionRepository;
    @Mock private ExamAttemptRepository attemptRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private AttendanceRecordRepository attendanceRepository;
    @Mock private AnalyticsService analytics;

    @InjectMocks private AlseService alse;

    private User student;
    private Course course;

    @BeforeEach
    void setUp() {
        student = TestFixtures.student(1L, "Test Student");
        course = TestFixtures.course(10L, "CS101", TestFixtures.teacher(2L, "Teacher"));

        when(stateRepository.findByStudentOrderByTimestampAsc(any())).thenReturn(List.of());
        when(stateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(chatMessageRepository.findAll()).thenReturn(List.of());
        when(attentionLogRepository.findByStudent(any())).thenReturn(List.of());
        when(analytics.quizPerformance(any())).thenReturn(OptionalInt.of(100)); // not struggling
    }

    /** Feeds one reading through the engine and returns the state it recorded. */
    private LearningStateLog classifyOne(double score, String eyeStatus, boolean tabActive) {
        when(attentionLogRepository.findByStudentOrderByTimestampAsc(student)).thenReturn(List.of(
                TestFixtures.attentionLog(student, score, eyeStatus, tabActive, LocalDateTime.now())
        ));

        List<LearningStateLog> states = alse.syncStates(student);
        assertThat(states).hasSize(1);
        return states.get(0);
    }

    // ───────────────────────────── classification ────────────────────────────

    @Nested
    @DisplayName("classifying an attention reading")
    class Classification {

        @ParameterizedTest(name = "attention {0} maps to {1}")
        @CsvSource({
                "95, DEEP_LEARNING",
                "85, DEEP_LEARNING",
                "84, FOCUSED",
                "70, FOCUSED",
                "69, PASSIVE_LEARNING",
                "50, PASSIVE_LEARNING",
                "49, DISTRACTED",
                "20, DISTRACTED"
        })
        @DisplayName("uses the score thresholds when the candidate is on task")
        void scoreThresholds(double score, String expected) {
            assertThat(classifyOne(score, "CENTER", true).getState().name()).isEqualTo(expected);
        }

        @Test
        @DisplayName("treats losing window focus as distraction regardless of a high score")
        void tabBlurBeatsScore() {
            LearningStateLog state = classifyOne(98, "CENTER", false);

            assertThat(state.getState()).isEqualTo(LearningStateLog.LearningState.DISTRACTED);
            assertThat(state.getEvidence()).contains("Non-course tab");
        }

        @Test
        @DisplayName("treats an empty frame as distraction and says so in the evidence")
        void noFaceIsDistracted() {
            LearningStateLog state = classifyOne(10, "NO_FACE", true);

            assertThat(state.getState()).isEqualTo(LearningStateLog.LearningState.DISTRACTED);
            assertThat(state.getEvidence()).contains("left the camera frame");
        }

        @Test
        @DisplayName("flags more than one face in frame")
        void multipleFaces() {
            LearningStateLog state = classifyOne(90, "MULTIPLE_FACES", true);

            assertThat(state.getState()).isEqualTo(LearningStateLog.LearningState.DISTRACTED);
            assertThat(state.getEvidence()).containsIgnoringCase("more than one face");
        }

        @Test
        @DisplayName("treats gaze off screen as passive rather than distracted")
        void lookingAwayIsPassive() {
            assertThat(classifyOne(80, "LOOKING_AWAY", true).getState())
                    .isEqualTo(LearningStateLog.LearningState.PASSIVE_LEARNING);
        }

        @Test
        @DisplayName("treats closed eyes as passive")
        void eyesClosedIsPassive() {
            assertThat(classifyOne(80, "EYES_CLOSED", true).getState())
                    .isEqualTo(LearningStateLog.LearningState.PASSIVE_LEARNING);
        }

        @Test
        @DisplayName("calls a present-but-underperforming student struggling, not distracted")
        void strugglingWhenAssessmentIsWeak() {
            when(analytics.quizPerformance(student)).thenReturn(OptionalInt.of(45));

            LearningStateLog state = classifyOne(72, "CENTER", true);

            assertThat(state.getState()).isEqualTo(LearningStateLog.LearningState.STRUGGLING);
            assertThat(state.getEvidence()).contains("low assessment accuracy");
        }

        @Test
        @DisplayName("does not call a high performer struggling even with weak assessments")
        void highAttentionOutranksStruggling() {
            when(analytics.quizPerformance(student)).thenReturn(OptionalInt.of(45));

            assertThat(classifyOne(90, "CENTER", true).getState())
                    .isEqualTo(LearningStateLog.LearningState.DEEP_LEARNING);
        }

        @Test
        @DisplayName("recognises chat activity around the reading as collaboration")
        void chatMakesItCollaborative() {
            LocalDateTime now = LocalDateTime.now();
            ChatMessage message = ChatMessage.builder()
                    .sender(student).content("Question about layer two").timestamp(now).build();
            when(chatMessageRepository.findAll()).thenReturn(List.of(message));
            when(attentionLogRepository.findByStudentOrderByTimestampAsc(student)).thenReturn(List.of(
                    TestFixtures.attentionLog(student, 80, "CENTER", true, now)
            ));

            List<LearningStateLog> states = alse.syncStates(student);

            assertThat(states.get(0).getState()).isEqualTo(LearningStateLog.LearningState.COLLABORATIVE);
            assertThat(states.get(0).getConfidence()).isGreaterThanOrEqualTo(88);
        }

        @Test
        @DisplayName("attaches the measured score to the evidence so the state is explainable")
        void evidenceCarriesTheNumber() {
            assertThat(classifyOne(91, "CENTER", true).getEvidence()).contains("91");
        }
    }

    // ─────────────────────────────── transitions ─────────────────────────────

    @Nested
    @DisplayName("recording transitions")
    class Transitions {

        @Test
        @DisplayName("records a state change once rather than on every reading")
        void onlyRecordsChanges() {
            LocalDateTime base = LocalDateTime.now().minusMinutes(30);
            when(attentionLogRepository.findByStudentOrderByTimestampAsc(student)).thenReturn(List.of(
                    TestFixtures.attentionLog(student, 92, "CENTER", true, base),
                    TestFixtures.attentionLog(student, 90, "CENTER", true, base.plusMinutes(5)),
                    TestFixtures.attentionLog(student, 88, "CENTER", true, base.plusMinutes(10)),
                    TestFixtures.attentionLog(student, 40, "CENTER", true, base.plusMinutes(15)),
                    TestFixtures.attentionLog(student, 35, "CENTER", true, base.plusMinutes(20))
            ));

            List<LearningStateLog> states = alse.syncStates(student);

            // Three deep-learning readings then two distracted ones: two rows.
            assertThat(states).hasSize(2);
            assertThat(states.get(0).getState()).isEqualTo(LearningStateLog.LearningState.DEEP_LEARNING);
            assertThat(states.get(1).getState()).isEqualTo(LearningStateLog.LearningState.DISTRACTED);
        }

        @Test
        @DisplayName("only processes readings newer than the last state it stored")
        void respectsTheWatermark() {
            LocalDateTime old = LocalDateTime.now().minusHours(2);
            LearningStateLog existing = LearningStateLog.builder()
                    .student(student).state(LearningStateLog.LearningState.FOCUSED)
                    .timestamp(old).confidence(80).build();
            when(stateRepository.findByStudentOrderByTimestampAsc(student)).thenReturn(List.of(existing));
            when(attentionLogRepository.findByStudentOrderByTimestampAsc(student)).thenReturn(List.of(
                    TestFixtures.attentionLog(student, 75, "CENTER", true, old.minusMinutes(10))
            ));

            alse.syncStates(student);

            verify(stateRepository, never()).save(any());
        }
    }

    // ────────────────────────────── explainability ───────────────────────────

    @Test
    @DisplayName("the explainable score sums seven weighted factors out of one hundred")
    void explainableScoreSumsFactors() {
        when(analytics.attendanceRate(student)).thenReturn(OptionalInt.of(90));      // 18/20
        when(analytics.assignmentCompletion(student)).thenReturn(OptionalInt.of(80)); // 16/20
        when(analytics.quizPerformance(student)).thenReturn(OptionalInt.of(60));      //  9/15
        when(analytics.coursesFor(student)).thenReturn(List.of(course));
        when(analytics.courseProgress(student, course)).thenReturn(50);               //  8/15
        when(analytics.participation(student)).thenReturn(70);                        //  7/10
        when(analytics.meanAttention(student)).thenReturn(OptionalInt.of(80));        //  8/10
        when(attentionLogRepository.findByStudent(student)).thenReturn(List.of(
                TestFixtures.attentionLog(student, 80)                                // 10/10 on task
        ));

        AlseDtos.ExplainableScore score = alse.explainableScore(student);

        assertThat(score.getBreakdown()).hasSize(7);
        assertThat(score.getTotal()).isEqualTo(76);
        assertThat(score.getBreakdown().stream().mapToInt(AlseDtos.ScoreFactor::getMax).sum()).isEqualTo(100);
        // The two weakest ratios are surfaced as the priority focus area.
        assertThat(score.getImprovementArea()).isEqualTo("Course Progress & Quiz Participation");
    }

    @Test
    @DisplayName("screen activity is the share of readings where the course tab kept focus")
    void screenActivityReflectsTabFocus() {
        when(analytics.attendanceRate(student)).thenReturn(OptionalInt.empty());
        when(analytics.assignmentCompletion(student)).thenReturn(OptionalInt.empty());
        when(analytics.quizPerformance(student)).thenReturn(OptionalInt.empty());
        when(analytics.coursesFor(student)).thenReturn(List.of());
        when(analytics.participation(student)).thenReturn(0);
        when(analytics.meanAttention(student)).thenReturn(OptionalInt.empty());
        when(attentionLogRepository.findByStudent(student)).thenReturn(List.of(
                TestFixtures.attentionLog(student, 80, "CENTER", true, LocalDateTime.now()),
                TestFixtures.attentionLog(student, 80, "CENTER", true, LocalDateTime.now()),
                TestFixtures.attentionLog(student, 80, "CENTER", false, LocalDateTime.now()),
                TestFixtures.attentionLog(student, 80, "CENTER", false, LocalDateTime.now())
        ));

        AlseDtos.ScoreFactor screen = alse.explainableScore(student).getBreakdown().stream()
                .filter(f -> f.getFactor().equals("Screen Activity")).findFirst().orElseThrow();

        assertThat(screen.getImpact()).isEqualTo(5); // 50% of 10
    }

    // ───────────────────────────── intervention loop ─────────────────────────

    @Nested
    @DisplayName("the intervention queue")
    class Interventions {

        @BeforeEach
        void atRiskStudent() {
            when(userRepository.findByRole(User.Role.STUDENT)).thenReturn(List.of(student));
            when(analytics.riskLevel(student)).thenReturn("high");
            when(analytics.attendanceRate(student)).thenReturn(OptionalInt.of(55));
            when(analytics.assignmentCompletion(student)).thenReturn(OptionalInt.of(30));
            when(analytics.meanAttention(student)).thenReturn(OptionalInt.of(45));
            when(analytics.quizPerformance(student)).thenReturn(OptionalInt.of(40));
            when(analytics.coursesFor(student)).thenReturn(List.of(course));
            when(analytics.courseScorePercent(student, course)).thenReturn(40);
            when(analytics.engagementScore(student)).thenReturn(48);
            when(attendanceRepository.findByStudent(student)).thenReturn(List.of());
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("raises an action for an at-risk student, carrying the evidence that triggered it")
        void raisesWithEvidence() {
            when(interventionRepository.findByStudentOrderByCreatedAtDesc(student)).thenReturn(List.of());

            alse.refreshInterventions();

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());

            Intervention raised = captor.getValue();
            assertThat(raised.getStatus()).isEqualTo(Intervention.Status.PENDING);
            assertThat(raised.getBaselineScore()).isEqualTo(48.0);
            assertThat(raised.getEvidence()).anyMatch(e -> e.contains("Attendance: 55%"));
            assertThat(raised.getEvidence()).anyMatch(e -> e.contains("Mean assessment accuracy: 40%"));
            assertThat(raised.getRecommendation()).isNotBlank();
        }

        @Test
        @DisplayName("leaves students who are not at risk alone")
        void ignoresHealthyStudents() {
            when(analytics.riskLevel(student)).thenReturn("low");

            alse.refreshInterventions();

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("does not stack a second action on top of one already pending")
        void doesNotDuplicateOpenActions() {
            when(interventionRepository.findByStudentOrderByCreatedAtDesc(student)).thenReturn(List.of(
                    Intervention.builder().student(student).status(Intervention.Status.PENDING).build()
            ));

            alse.refreshInterventions();

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("holds off for a cooldown after one was recently delivered")
        void respectsCooldown() {
            when(interventionRepository.findByStudentOrderByCreatedAtDesc(student)).thenReturn(List.of(
                    Intervention.builder().student(student).status(Intervention.Status.DELIVERED)
                            .resolvedAt(LocalDateTime.now().minusDays(2)).build()
            ));

            alse.refreshInterventions();

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("raises a fresh action once the cooldown has elapsed")
        void raisesAgainAfterCooldown() {
            when(interventionRepository.findByStudentOrderByCreatedAtDesc(student)).thenReturn(List.of(
                    Intervention.builder().student(student).status(Intervention.Status.DELIVERED)
                            .resolvedAt(LocalDateTime.now().minusDays(30)).build()
            ));

            alse.refreshInterventions();

            verify(interventionRepository).save(any());
        }

        @Test
        @DisplayName("approving records delivery and measures the outcome against the baseline")
        void approvingMeasuresOutcome() {
            Intervention pending = Intervention.builder()
                    .id(7L).student(student).status(Intervention.Status.PENDING)
                    .baselineScore(48.0)
                    .triggerState(LearningStateLog.LearningState.STRUGGLING)
                    .build();
            when(interventionRepository.findById(7L)).thenReturn(java.util.Optional.of(pending));
            when(analytics.engagementScore(student)).thenReturn(62); // improved since

            AlseDtos.InterventionView view = alse.decide(7L, true);

            assertThat(pending.getStatus()).isEqualTo(Intervention.Status.DELIVERED);
            assertThat(pending.getResolvedAt()).isNotNull();
            assertThat(view.getOutcome()).isNotNull();
            assertThat(view.getOutcome().getImprovement()).isEqualTo("+14%");
            assertThat(view.getOutcome().getStatus()).isEqualTo("Positive");
        }

        @Test
        @DisplayName("rejecting closes the action without inventing an outcome")
        void rejectingLeavesNoOutcome() {
            Intervention pending = Intervention.builder()
                    .id(8L).student(student).status(Intervention.Status.PENDING).baselineScore(48.0).build();
            when(interventionRepository.findById(8L)).thenReturn(java.util.Optional.of(pending));

            AlseDtos.InterventionView view = alse.decide(8L, false);

            assertThat(pending.getStatus()).isEqualTo(Intervention.Status.REJECTED);
            assertThat(view.getOutcome()).isNull();
        }
    }
}