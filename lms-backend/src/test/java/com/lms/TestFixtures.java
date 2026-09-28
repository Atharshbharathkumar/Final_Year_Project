package com.lms;

import com.lms.model.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Builders for the entity graphs the unit tests need.
 * <p>
 * Tests construct their own fixtures rather than leaning on the demonstration
 * seed, so a change to {@code DataInitializer} can never quietly change what a
 * test asserts.
 */
public final class TestFixtures {

    private TestFixtures() {
    }

    public static User student(long id, String name) {
        return User.builder()
                .id(id).email(name.toLowerCase().replace(' ', '.') + "@test.edu")
                .fullName(name).role(User.Role.STUDENT)
                .password("hashed").avatarEmoji("🎓")
                .build();
    }

    public static User teacher(long id, String name) {
        return User.builder()
                .id(id).email(name.toLowerCase().replace(' ', '.') + "@test.edu")
                .fullName(name).role(User.Role.TEACHER).password("hashed")
                .build();
    }

    public static Course course(long id, String code, User teacher) {
        return Course.builder()
                .id(id).courseCode(code).title(code + " Course")
                .teacher(teacher).totalSessions(10).creditHours(3)
                .build();
    }

    public static AttendanceRecord attendance(User student, Course course, LocalDate date, boolean present) {
        return AttendanceRecord.builder()
                .student(student).course(course).sessionDate(date).present(present)
                .build();
    }

    public static AttentionLog attentionLog(User student, double score) {
        return attentionLog(student, score, "CENTER", true, LocalDateTime.now());
    }

    public static AttentionLog attentionLog(User student, double score, String eyeStatus,
                                            boolean tabActive, LocalDateTime at) {
        return AttentionLog.builder()
                .student(student).sessionId(1L).contextType("CLASSROOM")
                .score(score).faceDetected(score > 15).faceCount(score > 15 ? 1 : 0)
                .eyeStatus(eyeStatus).isTabActive(tabActive).timestamp(at)
                .build();
    }

    public static Alert alert(User student, Alert.AlertType type) {
        return Alert.builder()
                .student(student).sessionId(1L).contextType("CLASSROOM")
                .alertType(type).severity(Alert.Severity.LOW)
                .message("test").timestamp(LocalDateTime.now())
                .build();
    }

    public static Assignment assignment(long id, Course course, int points) {
        return Assignment.builder()
                .id(id).course(course).title("Assignment " + id)
                .points(points).priority(Assignment.Priority.MEDIUM)
                .dueDate(LocalDateTime.now().plusDays(7))
                .build();
    }

    public static Submission submission(Assignment assignment, User student,
                                        Submission.Status status, Integer grade) {
        return Submission.builder()
                .id(assignment.getId() * 100 + student.getId())
                .assignment(assignment).student(student)
                .status(status).grade(grade)
                .submittedAt(LocalDateTime.now().minusDays(1))
                .build();
    }

    public static Enrollment enrollment(User student, Course course) {
        return Enrollment.builder().student(student).course(course).build();
    }

    public static Exam exam(long id, Course course, int durationMinutes, Integer maxTabSwitches) {
        return Exam.builder()
                .id(id).course(course).title("Exam " + id)
                .durationMinutes(durationMinutes)
                .lockdownEnabled(true).cameraRequired(false)
                .maxTabSwitches(maxTabSwitches)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now().plusDays(1))
                .build();
    }

    public static Question mcq(long id, Exam exam, String correctAnswer, int marks) {
        return Question.builder()
                .id(id).exam(exam).questionText("Question " + id)
                .type(Question.QuestionType.MCQ)
                .optionA("Option A").optionB("Option B").optionC("Option C").optionD("Option D")
                .correctAnswer(correctAnswer).marks(marks)
                .build();
    }

    public static Question shortAnswer(long id, Exam exam, int marks) {
        return Question.builder()
                .id(id).exam(exam).questionText("Explain question " + id)
                .type(Question.QuestionType.SHORT_ANSWER).marks(marks)
                .build();
    }

    public static ExamAttempt attempt(long id, Exam exam, User student,
                                      ExamAttempt.AttemptStatus status, int maxScore) {
        return ExamAttempt.builder()
                .id(id).exam(exam).student(student)
                .startTime(LocalDateTime.now().minusMinutes(5))
                .status(status).tabSwitchCount(0)
                .score(0).maxScore(maxScore)
                .averageAttentionScore(100.0)
                .build();
    }

    public static Answer answer(ExamAttempt attempt, Question question, String given) {
        return Answer.builder()
                .attempt(attempt).question(question).selectedOptionOrText(given)
                .build();
    }
}