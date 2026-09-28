package com.lms.service;

import com.lms.TestFixtures;
import com.lms.dto.AcademicDtos;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Grading is the write that closes the teaching loop, so it has to be both
 * correctly scoped (only the course owner) and correctly bounded (0..points).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AcademicServiceGradingTest {

    @Mock private CourseRepository courseRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private AssignmentRepository assignmentRepository;
    @Mock private SubmissionRepository submissionRepository;
    @Mock private ExamRepository examRepository;
    @Mock private ExamAttemptRepository attemptRepository;
    @Mock private CampusEventRepository eventRepository;
    @Mock private CreditActivityRepository creditRepository;
    @Mock private UserRepository userRepository;
    @Mock private AnalyticsService analytics;
    @Mock private NotificationService notificationService;

    @InjectMocks private AcademicService academic;

    private User owner;
    private User otherTeacher;
    private User admin;
    private User student;
    private Course course;
    private Assignment assignment;
    private Submission submission;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.teacher(1L, "Course Owner");
        otherTeacher = TestFixtures.teacher(2L, "Other Teacher");
        admin = User.builder().id(3L).fullName("Admin").email("admin@test.edu")
                .role(User.Role.ADMIN).password("hashed").build();
        student = TestFixtures.student(4L, "Test Student");

        course = TestFixtures.course(10L, "CS101", owner);
        assignment = TestFixtures.assignment(20L, course, 50);
        submission = TestFixtures.submission(assignment, student, Submission.Status.SUBMITTED, null);
        submission.setId(30L);

        when(submissionRepository.findById(30L)).thenReturn(Optional.of(submission));
        when(submissionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.findByCourse(course)).thenReturn(List.of());
    }

    private AcademicDtos.GradeRequest mark(int value) {
        return new AcademicDtos.GradeRequest(value, "Solid work.");
    }

    @Nested
    @DisplayName("grading a submission")
    class Grading {

        @Test
        @DisplayName("records the mark, the feedback and the time it was marked")
        void recordsTheMark() {
            AcademicDtos.SubmissionCard card = academic.gradeSubmission(30L, mark(47), owner);

            assertThat(submission.getStatus()).isEqualTo(Submission.Status.GRADED);
            assertThat(submission.getGrade()).isEqualTo(47);
            assertThat(submission.getFeedback()).isEqualTo("Solid work.");
            assertThat(submission.getGradedAt()).isNotNull();
            assertThat(card.getGrade()).isEqualTo(47);
        }

        @Test
        @DisplayName("notifies the student that their work has been marked")
        void notifiesTheStudent() {
            academic.gradeSubmission(30L, mark(47), owner);

            verify(notificationService).push(eq(student), eq("Assignment graded"), anyString(), eq("success"));
        }

        @Test
        @DisplayName("refuses a teacher who does not own the course")
        void refusesForeignTeacher() {
            assertThatThrownBy(() -> academic.gradeSubmission(30L, mark(47), otherTeacher))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("do not teach this course");

            assertThat(submission.getStatus()).isEqualTo(Submission.Status.SUBMITTED);
            verify(notificationService, never()).push(any(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("allows an administrator to mark any course")
        void allowsAdmin() {
            academic.gradeSubmission(30L, mark(40), admin);

            assertThat(submission.getStatus()).isEqualTo(Submission.Status.GRADED);
        }

        @Test
        @DisplayName("rejects a mark above the assignment's total")
        void rejectsMarkAboveMaximum() {
            assertThatThrownBy(() -> academic.gradeSubmission(30L, mark(51), owner))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("between 0 and 50");
        }

        @Test
        @DisplayName("rejects a negative mark")
        void rejectsNegativeMark() {
            assertThatThrownBy(() -> academic.gradeSubmission(30L, mark(-1), owner))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("between 0 and 50");
        }

        @Test
        @DisplayName("accepts the boundary values of zero and full marks")
        void acceptsBoundaries() {
            academic.gradeSubmission(30L, mark(0), owner);
            assertThat(submission.getGrade()).isZero();

            academic.gradeSubmission(30L, mark(50), owner);
            assertThat(submission.getGrade()).isEqualTo(50);
        }

        @Test
        @DisplayName("refuses to mark work that has not been submitted")
        void refusesUnsubmittedWork() {
            submission.setStatus(Submission.Status.IN_PROGRESS);

            assertThatThrownBy(() -> academic.gradeSubmission(30L, mark(20), owner))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Only submitted work");
        }

        @Test
        @DisplayName("allows a mark to be revised after it was first given")
        void allowsRemarking() {
            academic.gradeSubmission(30L, mark(30), owner);
            academic.gradeSubmission(30L, mark(45), owner);

            assertThat(submission.getGrade()).isEqualTo(45);
        }
    }

    @Nested
    @DisplayName("creating an assignment")
    class Creating {

        private AcademicDtos.CreateAssignmentRequest request(String title, String dueDate, String priority) {
            AcademicDtos.CreateAssignmentRequest r = new AcademicDtos.CreateAssignmentRequest();
            r.setCourseId(10L);
            r.setTitle(title);
            r.setDueDate(dueDate);
            r.setPriority(priority);
            r.setPoints(100);
            return r;
        }

        @BeforeEach
        void savesAssignments() {
            when(assignmentRepository.save(any())).thenAnswer(inv -> {
                Assignment saved = inv.getArgument(0);
                saved.setId(99L);
                return saved;
            });
        }

        @Test
        @DisplayName("publishes onto a course the caller owns")
        void publishesOnOwnedCourse() {
            AcademicDtos.AssignmentCard card = academic.createAssignment(
                    request("New Task", "2026-09-30", "HIGH"), owner);

            assertThat(card.getTitle()).isEqualTo("New Task");
            assertThat(card.getPriority()).isEqualTo("high");
            assertThat(card.getDueDate()).isEqualTo("2026-09-30");
        }

        @Test
        @DisplayName("refuses a course the caller does not teach")
        void refusesForeignCourse() {
            assertThatThrownBy(() -> academic.createAssignment(
                    request("New Task", "2026-09-30", "HIGH"), otherTeacher))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("do not teach this course");
        }

        @Test
        @DisplayName("rejects a malformed due date instead of storing something wrong")
        void rejectsBadDate() {
            assertThatThrownBy(() -> academic.createAssignment(
                    request("New Task", "30/09/2026", "HIGH"), owner))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("yyyy-MM-dd");
        }

        @Test
        @DisplayName("rejects a blank title")
        void rejectsBlankTitle() {
            assertThatThrownBy(() -> academic.createAssignment(
                    request("   ", "2026-09-30", "HIGH"), owner))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("needs a title");
        }

        @Test
        @DisplayName("rejects an unknown priority")
        void rejectsUnknownPriority() {
            assertThatThrownBy(() -> academic.createAssignment(
                    request("New Task", "2026-09-30", "URGENT"), owner))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("LOW, MEDIUM or HIGH");
        }

        @Test
        @DisplayName("notifies every enrolled student that new work has been posted")
        void notifiesTheCohort() {
            User second = TestFixtures.student(5L, "Second Student");
            when(enrollmentRepository.findByCourse(course)).thenReturn(List.of(
                    TestFixtures.enrollment(student, course),
                    TestFixtures.enrollment(second, course)
            ));

            academic.createAssignment(request("New Task", "2026-09-30", "MEDIUM"), owner);

            verify(notificationService).push(eq(student), eq("New assignment posted"), anyString(), eq("info"));
            verify(notificationService).push(eq(second), eq("New assignment posted"), anyString(), eq("info"));
        }
    }
}