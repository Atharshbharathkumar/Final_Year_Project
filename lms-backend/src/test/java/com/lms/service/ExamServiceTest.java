package com.lms.service;

import com.lms.TestFixtures;
import com.lms.dto.ExamDtos;
import com.lms.dto.ExamSubmissionDto;
import com.lms.model.*;
import com.lms.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Exams carry the two rules that matter most in this system: the answer key must
 * never leave the server, and an attempt id in a URL is not authorisation.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExamServiceTest {

    @Mock private ExamRepository examRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private ExamAttemptRepository attemptRepository;
    @Mock private AnswerRepository answerRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private UserRepository userRepository;
    @Mock private MonitoringService monitoringService;
    @Mock private AiIntelligenceService aiIntelligenceService;

    @InjectMocks private ExamService examService;

    private User candidate;
    private User otherStudent;
    private User teacher;
    private Course course;
    private Exam exam;
    private Question mcq;
    private Question written;

    @BeforeEach
    void setUp() {
        candidate = TestFixtures.student(1L, "Candidate One");
        otherStudent = TestFixtures.student(2L, "Candidate Two");
        teacher = TestFixtures.teacher(3L, "Marker");
        course = TestFixtures.course(10L, "CS101", teacher);
        exam = TestFixtures.exam(100L, course, 30, 3);
        mcq = TestFixtures.mcq(1000L, exam, "B", 5);
        written = TestFixtures.shortAnswer(1001L, exam, 10);
        exam.setQuestions(List.of(mcq, written));

        when(examRepository.findById(100L)).thenReturn(Optional.of(exam));
        when(questionRepository.findByExam(exam)).thenReturn(List.of(mcq, written));
        when(enrollmentRepository.findByStudentAndCourse(candidate, course))
                .thenReturn(Optional.of(TestFixtures.enrollment(candidate, course)));
        when(answerRepository.findByAttempt(any())).thenReturn(List.of());
        when(attemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(answerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(aiIntelligenceService.evaluateExamIntegrity(anyLong()))
                .thenReturn(AiIntelligenceService.ExamIntegrityAnalysis.builder()
                        .integrityConfidenceScore(90.0).status("VERIFIED_HIGH_INTEGRITY")
                        .flaggedAnomalies(List.of("No violations registered.")).build());
    }

    // ──────────────────────────── the answer key ─────────────────────────────

    @Nested
    @DisplayName("the candidate's paper")
    class Paper {

        @Test
        @DisplayName("never carries the correct answer")
        void hidesTheAnswerKey() {
            ExamDtos.ExamPaper paper = examService.getPaper(100L, candidate);

            assertThat(paper.getQuestions()).hasSize(2);
            // The DTO has no field for it at all; assert on the declared shape so
            // that re-adding one would fail this test.
            assertThat(ExamDtos.PaperQuestion.class.getDeclaredFields())
                    .extracting(java.lang.reflect.Field::getName)
                    .doesNotContain("correctAnswer");
            assertThat(paper.getQuestions().get(0).getOptionB()).isEqualTo("Option B");
        }

        @Test
        @DisplayName("totals the marks across every question")
        void totalsMarks() {
            assertThat(examService.getPaper(100L, candidate).getTotalMarks()).isEqualTo(15);
            assertThat(examService.getPaper(100L, candidate).getQuestionCount()).isEqualTo(2);
        }

        @Test
        @DisplayName("is refused to a student who is not enrolled on the course")
        void refusesNonEnrolledStudent() {
            when(enrollmentRepository.findByStudentAndCourse(otherStudent, course))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> examService.getPaper(100L, otherStudent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not enrolled");
        }

        @Test
        @DisplayName("is available to staff without an enrolment, so they can preview it")
        void allowsStaff() {
            when(enrollmentRepository.findByStudentAndCourse(teacher, course)).thenReturn(Optional.empty());

            assertThat(examService.getPaper(100L, teacher).getTitle()).isEqualTo("Exam 100");
        }
    }

    // ───────────────────────────── starting a sitting ────────────────────────

    @Nested
    @DisplayName("starting an attempt")
    class Starting {

        @Test
        @DisplayName("creates a fresh attempt with the paper's total as the maximum score")
        void createsAttempt() {
            when(attemptRepository.findByStudentAndExamAndStatus(candidate, exam, ExamAttempt.AttemptStatus.IN_PROGRESS))
                    .thenReturn(Optional.empty());
            when(attemptRepository.findByStudent(candidate)).thenReturn(List.of());

            ExamDtos.AttemptState state = examService.startAttempt(100L, candidate);

            assertThat(state.getStatus()).isEqualTo("IN_PROGRESS");
            assertThat(state.getMaxTabSwitches()).isEqualTo(3);
            assertThat(state.getSecondsRemaining()).isGreaterThan(0);
        }

        @Test
        @DisplayName("resumes the attempt already running instead of restarting the clock")
        void resumesInProgress() {
            ExamAttempt running = TestFixtures.attempt(500L, exam, candidate,
                    ExamAttempt.AttemptStatus.IN_PROGRESS, 15);
            when(attemptRepository.findByStudentAndExamAndStatus(candidate, exam, ExamAttempt.AttemptStatus.IN_PROGRESS))
                    .thenReturn(Optional.of(running));

            ExamDtos.AttemptState state = examService.startAttempt(100L, candidate);

            assertThat(state.getAttemptId()).isEqualTo(500L);
            // No new row may be written when resuming.
            verify(attemptRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses a second sitting once the paper has been submitted")
        void refusesResit() {
            when(attemptRepository.findByStudentAndExamAndStatus(candidate, exam, ExamAttempt.AttemptStatus.IN_PROGRESS))
                    .thenReturn(Optional.empty());
            when(attemptRepository.findByStudent(candidate)).thenReturn(List.of(
                    TestFixtures.attempt(500L, exam, candidate, ExamAttempt.AttemptStatus.SUBMITTED, 15)
            ));

            assertThatThrownBy(() -> examService.startAttempt(100L, candidate))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already submitted");
        }

        @Test
        @DisplayName("refuses a student who is not enrolled")
        void refusesNonEnrolled() {
            when(enrollmentRepository.findByStudentAndCourse(otherStudent, course)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> examService.startAttempt(100L, otherStudent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not enrolled");
        }

        @Test
        @DisplayName("refuses to open an exam whose window has closed")
        void refusesClosedExam() {
            exam.setEndTime(java.time.LocalDateTime.now().minusDays(1));

            assertThatThrownBy(() -> examService.startAttempt(100L, candidate))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("closed");
        }
    }

    // ──────────────────────────── attempt ownership ──────────────────────────

    @Nested
    @DisplayName("attempt ownership")
    class Ownership {

        private ExamAttempt running;

        @BeforeEach
        void attemptExists() {
            running = TestFixtures.attempt(500L, exam, candidate, ExamAttempt.AttemptStatus.IN_PROGRESS, 15);
            when(attemptRepository.findById(500L)).thenReturn(Optional.of(running));
        }

        @Test
        @DisplayName("blocks another student from reading the attempt")
        void blocksForeignRead() {
            assertThatThrownBy(() -> examService.getAttemptState(500L, otherStudent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not belong to you");
        }

        @Test
        @DisplayName("blocks another student from saving an answer into it")
        void blocksForeignAnswer() {
            assertThatThrownBy(() -> examService.saveAnswer(500L, otherStudent, 1000L, "B"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not belong to you");
            verify(answerRepository, never()).save(any());
        }

        @Test
        @DisplayName("blocks another student from submitting it")
        void blocksForeignSubmit() {
            ExamSubmissionDto dto = new ExamSubmissionDto();
            dto.setAttemptId(500L);

            assertThatThrownBy(() -> examService.submit(dto, otherStudent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not belong to you");
        }

        @Test
        @DisplayName("blocks another student from burning its tab-switch budget")
        void blocksForeignTabSwitch() {
            assertThatThrownBy(() -> examService.registerTabSwitch(500L, otherStudent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not belong to you");
        }

        @Test
        @DisplayName("rejects a missing attempt id rather than failing deep in the data layer")
        void rejectsNullId() {
            assertThatThrownBy(() -> examService.getAttemptState(null, candidate))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("attempt id is required");
        }

        @Test
        @DisplayName("lets staff read any attempt so they can review it")
        void staffMayReadAnyAttempt() {
            running.setStatus(ExamAttempt.AttemptStatus.SUBMITTED);

            assertThat(examService.getResult(500L, teacher).getAttemptId()).isEqualTo(500L);
        }

        @Test
        @DisplayName("stops a student reading someone else's result")
        void studentMayNotReadForeignResult() {
            assertThatThrownBy(() -> examService.getResult(500L, otherStudent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not belong to you");
        }
    }

    // ─────────────────────────────── lockdown ────────────────────────────────

    @Nested
    @DisplayName("tab-switch lockdown")
    class Lockdown {

        private ExamAttempt running;

        @BeforeEach
        void attemptExists() {
            running = TestFixtures.attempt(500L, exam, candidate, ExamAttempt.AttemptStatus.IN_PROGRESS, 15);
            when(attemptRepository.findById(500L)).thenReturn(Optional.of(running));
        }

        @Test
        @DisplayName("counts each switch on the server and raises a proctoring alert")
        void countsAndAlerts() {
            ExamDtos.TabSwitchResult first = examService.registerTabSwitch(500L, candidate);

            assertThat(first.getTabSwitchCount()).isEqualTo(1);
            assertThat(first.getTerminated()).isFalse();
            verify(monitoringService).raiseExamAlert(eq(candidate), eq(500L),
                    eq(Alert.AlertType.TAB_SWITCH), eq(Alert.Severity.HIGH), anyString());
        }

        @Test
        @DisplayName("auto-submits the paper on reaching the limit and marks it a violation")
        void terminatesAtLimit() {
            examService.registerTabSwitch(500L, candidate);
            examService.registerTabSwitch(500L, candidate);
            ExamDtos.TabSwitchResult third = examService.registerTabSwitch(500L, candidate);

            assertThat(third.getTabSwitchCount()).isEqualTo(3);
            assertThat(third.getTerminated()).isTrue();
            assertThat(running.getStatus()).isEqualTo(ExamAttempt.AttemptStatus.AUTO_SUBMITTED_VIOLATION);
            assertThat(running.getEndTime()).isNotNull();
            verify(monitoringService).raiseExamAlert(any(), anyLong(),
                    eq(Alert.AlertType.TAB_SWITCH), eq(Alert.Severity.CRITICAL), anyString());
        }

        @Test
        @DisplayName("does not keep counting once the attempt is closed")
        void ignoresSwitchesAfterClose() {
            running.setStatus(ExamAttempt.AttemptStatus.SUBMITTED);
            running.setTabSwitchCount(1);

            ExamDtos.TabSwitchResult result = examService.registerTabSwitch(500L, candidate);

            assertThat(result.getTerminated()).isTrue();
            assertThat(result.getTabSwitchCount()).isEqualTo(1);
            verify(monitoringService, never()).raiseExamAlert(any(), anyLong(), any(), any(), anyString());
        }
    }

    // ──────────────────────────────── marking ────────────────────────────────

    @Nested
    @DisplayName("marking on submission")
    class Marking {

        private ExamAttempt running;

        @BeforeEach
        void attemptExists() {
            running = TestFixtures.attempt(500L, exam, candidate, ExamAttempt.AttemptStatus.IN_PROGRESS, 15);
            when(attemptRepository.findById(500L)).thenReturn(Optional.of(running));
        }

        private ExamDtos.AttemptResult submitWith(String mcqAnswer, String writtenAnswer) {
            when(answerRepository.findByAttempt(running)).thenReturn(List.of(
                    TestFixtures.answer(running, mcq, mcqAnswer),
                    TestFixtures.answer(running, written, writtenAnswer)
            ));
            ExamSubmissionDto dto = new ExamSubmissionDto();
            dto.setAttemptId(500L);
            return examService.submit(dto, candidate);
        }

        @Test
        @DisplayName("awards the marks for a correct multiple choice answer")
        void awardsCorrectMcq() {
            submitWith("B", "A considered explanation.");
            assertThat(running.getScore()).isEqualTo(15); // 5 + 10
        }

        @Test
        @DisplayName("awards nothing for the wrong option")
        void refusesWrongMcq() {
            submitWith("C", "A considered explanation.");
            assertThat(running.getScore()).isEqualTo(10); // written only
        }

        @Test
        @DisplayName("ignores case and padding when matching the option letter")
        void toleratesCasingAndWhitespace() {
            submitWith(" b ", "");
            assertThat(running.getScore()).isEqualTo(5);
        }

        @Test
        @DisplayName("gives a written answer its marks only when something was written")
        void blankWrittenAnswerScoresNothing() {
            submitWith("C", "   ");
            assertThat(running.getScore()).isZero();
        }

        @Test
        @DisplayName("closes the attempt as submitted and stamps the finish time")
        void closesTheAttempt() {
            ExamDtos.AttemptResult result = submitWith("B", "Explanation.");

            assertThat(running.getStatus()).isEqualTo(ExamAttempt.AttemptStatus.SUBMITTED);
            assertThat(running.getEndTime()).isNotNull();
            assertThat(result.getPercentage()).isEqualTo(100);
        }

        @Test
        @DisplayName("records a violation rather than a clean submission when the tab limit was hit")
        void violationStatusWins() {
            running.setTabSwitchCount(3);
            submitWith("B", "Explanation.");

            assertThat(running.getStatus()).isEqualTo(ExamAttempt.AttemptStatus.AUTO_SUBMITTED_VIOLATION);
        }

        @Test
        @DisplayName("is idempotent: resubmitting does not re-mark a closed attempt")
        void doesNotRemarkClosedAttempt() {
            running.setStatus(ExamAttempt.AttemptStatus.SUBMITTED);
            running.setScore(7);

            ExamSubmissionDto dto = new ExamSubmissionDto();
            dto.setAttemptId(500L);
            examService.submit(dto, candidate);

            assertThat(running.getScore()).isEqualTo(7);
        }
    }

    // ─────────────────────────────── autosave ────────────────────────────────

    @Nested
    @DisplayName("answer autosave")
    class Autosave {

        private ExamAttempt running;

        @BeforeEach
        void attemptExists() {
            running = TestFixtures.attempt(500L, exam, candidate, ExamAttempt.AttemptStatus.IN_PROGRESS, 15);
            when(attemptRepository.findById(500L)).thenReturn(Optional.of(running));
            when(questionRepository.findById(1000L)).thenReturn(Optional.of(mcq));
            when(answerRepository.findByAttemptAndQuestion(running, mcq)).thenReturn(Optional.empty());
        }

        @Test
        @DisplayName("stores the response without marking it")
        void storesWithoutMarking() {
            examService.saveAnswer(500L, candidate, 1000L, "B");

            verify(answerRepository, times(1)).save(any(Answer.class));
        }

        @Test
        @DisplayName("refuses to accept answers into a closed attempt")
        void refusesAfterSubmission() {
            running.setStatus(ExamAttempt.AttemptStatus.SUBMITTED);

            assertThatThrownBy(() -> examService.saveAnswer(500L, candidate, 1000L, "B"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already been submitted");
        }

        @Test
        @DisplayName("refuses a question that belongs to a different exam")
        void refusesForeignQuestion() {
            Exam otherExam = TestFixtures.exam(200L, course, 30, 3);
            Question foreign = TestFixtures.mcq(2000L, otherExam, "A", 5);
            when(questionRepository.findById(2000L)).thenReturn(Optional.of(foreign));

            assertThatThrownBy(() -> examService.saveAnswer(500L, candidate, 2000L, "A"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not part of this exam");
        }

        @Test
        @DisplayName("a stale question id in a bulk submit does not void the whole paper")
        void staleIdDoesNotVoidSubmission() {
            when(questionRepository.findById(9999L)).thenReturn(Optional.empty());
            when(answerRepository.findByAttempt(running)).thenReturn(List.of(
                    TestFixtures.answer(running, mcq, "B")
            ));

            ExamSubmissionDto dto = new ExamSubmissionDto();
            dto.setAttemptId(500L);
            dto.setAnswers(Map.of(9999L, "X"));

            examService.submit(dto, candidate);

            assertThat(running.getStatus()).isEqualTo(ExamAttempt.AttemptStatus.SUBMITTED);
            assertThat(running.getScore()).isEqualTo(5);
        }
    }
}