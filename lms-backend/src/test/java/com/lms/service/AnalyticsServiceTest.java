package com.lms.service;

import com.lms.TestFixtures;
import com.lms.model.*;
import com.lms.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;
import java.util.OptionalInt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

/**
 * The scoring engine is the part of this system every dashboard depends on, so
 * these tests pin down the exact arithmetic rather than just "returns a number".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AnalyticsServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private AssignmentRepository assignmentRepository;
    @Mock private SubmissionRepository submissionRepository;
    @Mock private AttendanceRecordRepository attendanceRepository;
    @Mock private AttentionLogRepository attentionLogRepository;
    @Mock private AlertRepository alertRepository;
    @Mock private ExamAttemptRepository attemptRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private ClassroomSessionRepository sessionRepository;

    @InjectMocks private AnalyticsService analytics;

    private User student;
    private User teacher;
    private Course course;

    @BeforeEach
    void setUp() {
        student = TestFixtures.student(1L, "Test Student");
        teacher = TestFixtures.teacher(2L, "Test Teacher");
        course = TestFixtures.course(10L, "CS101", teacher);
        noData();
    }

    /** Default: every source empty. Individual tests fill in only what they exercise. */
    private void noData() {
        when(attendanceRepository.findByStudent(any())).thenReturn(List.of());
        when(enrollmentRepository.findByStudent(any())).thenReturn(List.of());
        when(submissionRepository.findByStudent(any())).thenReturn(List.of());
        when(attentionLogRepository.findByStudent(any())).thenReturn(List.of());
        when(attemptRepository.findByStudent(any())).thenReturn(List.of());
        when(alertRepository.findByStudentOrderByTimestampDesc(any())).thenReturn(List.of());
        when(assignmentRepository.findByCourseInOrderByDueDateAsc(anyCollection())).thenReturn(List.of());
    }

    private void withAttendance(int present, int absent) {
        var records = new java.util.ArrayList<AttendanceRecord>();
        for (int i = 0; i < present; i++) {
            records.add(TestFixtures.attendance(student, course, LocalDate.now().minusDays(i), true));
        }
        for (int i = 0; i < absent; i++) {
            records.add(TestFixtures.attendance(student, course, LocalDate.now().minusDays(100 + i), false));
        }
        when(attendanceRepository.findByStudent(student)).thenReturn(records);
    }

    private void withAttempts(int scored, int max) {
        ExamAttempt attempt = TestFixtures.attempt(1L, TestFixtures.exam(1L, course, 60, 3),
                student, ExamAttempt.AttemptStatus.SUBMITTED, max);
        attempt.setScore(scored);
        when(attemptRepository.findByStudent(student)).thenReturn(List.of(attempt));
    }

    // ───────────────────────────── component scores ──────────────────────────

    @Nested
    @DisplayName("attendanceRate")
    class AttendanceRate {

        @Test
        @DisplayName("is empty when nothing has been recorded, so callers can tell 'no data' from zero")
        void emptyWhenNoRecords() {
            assertThat(analytics.attendanceRate(student)).isEqualTo(OptionalInt.empty());
        }

        @Test
        @DisplayName("is the percentage of sessions marked present")
        void percentagePresent() {
            withAttendance(3, 1);
            assertThat(analytics.attendanceRate(student)).hasValue(75);
        }

        @Test
        @DisplayName("rounds to the nearest whole percent")
        void rounds() {
            withAttendance(2, 1); // 66.66…
            assertThat(analytics.attendanceRate(student)).hasValue(67);
        }
    }

    @Nested
    @DisplayName("assignmentCompletion")
    class AssignmentCompletion {

        @Test
        @DisplayName("is empty when the student has no assigned work")
        void emptyWhenNothingAssigned() {
            assertThat(analytics.assignmentCompletion(student)).isEqualTo(OptionalInt.empty());
        }

        @Test
        @DisplayName("counts submitted and graded work as done, and ignores in-progress")
        void countsSubmittedAndGraded() {
            Assignment a1 = TestFixtures.assignment(1L, course, 100);
            Assignment a2 = TestFixtures.assignment(2L, course, 100);
            Assignment a3 = TestFixtures.assignment(3L, course, 100);
            Assignment a4 = TestFixtures.assignment(4L, course, 100);

            when(enrollmentRepository.findByStudent(student))
                    .thenReturn(List.of(TestFixtures.enrollment(student, course)));
            when(assignmentRepository.findByCourseInOrderByDueDateAsc(anyCollection()))
                    .thenReturn(List.of(a1, a2, a3, a4));
            when(submissionRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.submission(a1, student, Submission.Status.GRADED, 80),
                    TestFixtures.submission(a2, student, Submission.Status.SUBMITTED, null),
                    TestFixtures.submission(a3, student, Submission.Status.IN_PROGRESS, null)
            ));

            // 2 of 4 count; in-progress and the untouched one do not.
            assertThat(analytics.assignmentCompletion(student)).hasValue(50);
        }
    }

    @Nested
    @DisplayName("quizPerformance")
    class QuizPerformance {

        @Test
        @DisplayName("ignores attempts still in progress")
        void ignoresInProgress() {
            ExamAttempt live = TestFixtures.attempt(1L, TestFixtures.exam(1L, course, 60, 3),
                    student, ExamAttempt.AttemptStatus.IN_PROGRESS, 100);
            when(attemptRepository.findByStudent(student)).thenReturn(List.of(live));

            assertThat(analytics.quizPerformance(student)).isEqualTo(OptionalInt.empty());
        }

        @Test
        @DisplayName("is the mean percentage across submitted attempts")
        void meanPercentage() {
            withAttempts(18, 25); // 72%
            assertThat(analytics.quizPerformance(student)).hasValue(72);
        }
    }

    // ──────────────────────────── composite scoring ──────────────────────────

    @Nested
    @DisplayName("engagementScore")
    class EngagementScore {

        @Test
        @DisplayName("is zero when the student has no data at all")
        void zeroWithoutData() {
            assertThat(analytics.engagementScore(student)).isZero();
        }

        @Test
        @DisplayName("renormalises the weights when only one component has data")
        void renormalisesSingleComponent() {
            withAttendance(8, 2); // 80% attendance, weight 0.30, nothing else

            // Without renormalisation this would be 80 * 0.30 = 24.
            assertThat(analytics.engagementScore(student)).isEqualTo(80);
        }

        @Test
        @DisplayName("renormalises across the subset of components that have data")
        void renormalisesTwoComponents() {
            withAttendance(8, 2);   // 80, weight 0.30
            withAttempts(60, 100);  // 60, weight 0.20

            // (80*0.30 + 60*0.20) / 0.50 = 72
            assertThat(analytics.engagementScore(student)).isEqualTo(72);
        }

        @Test
        @DisplayName("applies the full weighting when every component has data")
        void fullWeighting() {
            withAttendance(9, 1);  // 90 * 0.30 = 27
            withAttempts(80, 100); // 80 * 0.20 = 16
            when(attentionLogRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.attentionLog(student, 70), TestFixtures.attentionLog(student, 70)
            )); // 70 * 0.25 = 17.5

            Assignment a1 = TestFixtures.assignment(1L, course, 100);
            Assignment a2 = TestFixtures.assignment(2L, course, 100);
            when(enrollmentRepository.findByStudent(student))
                    .thenReturn(List.of(TestFixtures.enrollment(student, course)));
            when(assignmentRepository.findByCourseInOrderByDueDateAsc(anyCollection()))
                    .thenReturn(List.of(a1, a2));
            when(submissionRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.submission(a1, student, Submission.Status.GRADED, 90)
            )); // 50 * 0.25 = 12.5

            // 27 + 16 + 17.5 + 12.5 = 73
            assertThat(analytics.engagementScore(student)).isEqualTo(73);
        }

        @Test
        @DisplayName("deducts three points per alert")
        void deductsPerAlert() {
            withAttendance(10, 0); // a clean 100
            when(alertRepository.findByStudentOrderByTimestampDesc(student)).thenReturn(List.of(
                    TestFixtures.alert(student, Alert.AlertType.LOOKING_AWAY),
                    TestFixtures.alert(student, Alert.AlertType.TAB_SWITCH)
            ));

            assertThat(analytics.engagementScore(student)).isEqualTo(94); // 100 - 6
        }

        @Test
        @DisplayName("caps the alert penalty at fifteen points however many alerts there are")
        void capsAlertPenalty() {
            withAttendance(10, 0);
            var alerts = new java.util.ArrayList<Alert>();
            for (int i = 0; i < 40; i++) alerts.add(TestFixtures.alert(student, Alert.AlertType.NO_FACE));
            when(alertRepository.findByStudentOrderByTimestampDesc(student)).thenReturn(alerts);

            // 40 alerts would be -120 uncapped; the cap holds it at -15.
            assertThat(analytics.engagementScore(student)).isEqualTo(85);
        }

        @Test
        @DisplayName("never returns a negative score")
        void clampsAtZero() {
            withAttendance(0, 10); // 0% attendance
            var alerts = new java.util.ArrayList<Alert>();
            for (int i = 0; i < 10; i++) alerts.add(TestFixtures.alert(student, Alert.AlertType.NO_FACE));
            when(alertRepository.findByStudentOrderByTimestampDesc(student)).thenReturn(alerts);

            assertThat(analytics.engagementScore(student)).isZero();
        }
    }

    @Nested
    @DisplayName("gpa")
    class Gpa {

        @Test
        @DisplayName("is zero when nothing has been graded")
        void zeroWithoutGrades() {
            assertThat(analytics.gpa(student)).isZero();
        }

        @Test
        @DisplayName("maps the mean percentage onto the four-point scale")
        void mapsToFourPoint() {
            Assignment a = TestFixtures.assignment(1L, course, 100);
            when(submissionRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.submission(a, student, Submission.Status.GRADED, 75)
            ));

            assertThat(analytics.gpa(student)).isEqualTo(3.0); // 75% of 4.0
        }

        @Test
        @DisplayName("averages coursework and exams together")
        void averagesBothSources() {
            Assignment a = TestFixtures.assignment(1L, course, 100);
            when(submissionRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.submission(a, student, Submission.Status.GRADED, 100)
            ));
            withAttempts(50, 100);

            // mean of 100% and 50% is 75% -> 3.0
            assertThat(analytics.gpa(student)).isEqualTo(3.0);
        }

        @Test
        @DisplayName("ignores work that has not been graded yet")
        void ignoresUngraded() {
            Assignment a = TestFixtures.assignment(1L, course, 100);
            when(submissionRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.submission(a, student, Submission.Status.SUBMITTED, null)
            ));

            assertThat(analytics.gpa(student)).isZero();
        }
    }

    @Nested
    @DisplayName("riskLevel")
    class RiskLevel {

        @Test
        @DisplayName("is high when attendance falls below the seventy-five percent threshold")
        void highOnLowAttendance() {
            withAttendance(74, 26); // 74%
            assertThat(analytics.riskLevel(student)).isEqualTo("high");
        }

        @Test
        @DisplayName("is medium at exactly the attendance threshold")
        void mediumAtThreshold() {
            withAttendance(75, 25); // 75% -> engagement 75, so medium not high
            assertThat(analytics.riskLevel(student)).isEqualTo("medium");
        }

        @Test
        @DisplayName("is low only once both engagement and attendance clear the upper bands")
        void lowWhenHealthy() {
            withAttendance(90, 10); // 90%
            assertThat(analytics.riskLevel(student)).isEqualTo("low");
        }
    }

    @ParameterizedTest(name = "{0}% maps to grade {1}")
    @CsvSource({
            "95, A+", "90, A+", "89, A", "85, A", "84, A-", "80, A-",
            "79, B+", "75, B+", "74, B", "70, B", "69, B-", "65, B-",
            "64, C+", "60, C+", "59, C", "50, C", "49, D", "0, D"
    })
    @DisplayName("letterGrade boundaries")
    void letterGradeBoundaries(int percentage, String expected) {
        assertThat(analytics.letterGrade(percentage)).isEqualTo(expected);
    }

    @Test
    @DisplayName("clamp keeps values inside nought to one hundred")
    void clampBounds() {
        assertThat(AnalyticsService.clamp(-40)).isZero();
        assertThat(AnalyticsService.clamp(140)).isEqualTo(100);
        assertThat(AnalyticsService.clamp(55)).isEqualTo(55);
    }

    @Nested
    @DisplayName("courseProgress")
    class CourseProgress {

        @Test
        @DisplayName("blends syllabus coverage with this student's own completion")
        void blendsCoverageAndCompletion() {
            // 5 distinct session dates of a planned 10 -> 50% coverage.
            when(attendanceRepository.findByCourse(course)).thenReturn(List.of(
                    TestFixtures.attendance(student, course, LocalDate.now().minusDays(1), true),
                    TestFixtures.attendance(student, course, LocalDate.now().minusDays(2), true),
                    TestFixtures.attendance(student, course, LocalDate.now().minusDays(3), false),
                    TestFixtures.attendance(student, course, LocalDate.now().minusDays(4), true),
                    TestFixtures.attendance(student, course, LocalDate.now().minusDays(5), true)
            ));

            Assignment a1 = TestFixtures.assignment(1L, course, 100);
            Assignment a2 = TestFixtures.assignment(2L, course, 100);
            when(assignmentRepository.findByCourse(course)).thenReturn(List.of(a1, a2));
            when(submissionRepository.findByStudent(student)).thenReturn(List.of(
                    TestFixtures.submission(a1, student, Submission.Status.GRADED, 90)
            )); // 50% completion

            // 0.5 * 50 + 0.5 * 50 = 50
            assertThat(analytics.courseProgress(student, course)).isEqualTo(50);
        }

        @Test
        @DisplayName("counts repeated attendance rows on one date as a single session")
        void countsDistinctSessionDates() {
            LocalDate day = LocalDate.now().minusDays(1);
            User other = TestFixtures.student(9L, "Other Student");
            when(attendanceRepository.findByCourse(course)).thenReturn(List.of(
                    TestFixtures.attendance(student, course, day, true),
                    TestFixtures.attendance(other, course, day, true)
            ));
            when(assignmentRepository.findByCourse(course)).thenReturn(List.of());

            // One distinct date of ten planned -> 10% coverage, and with no
            // coursework the completion half mirrors coverage.
            assertThat(analytics.courseProgress(student, course)).isEqualTo(10);
        }
    }
}