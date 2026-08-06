package com.lms.service;

import com.lms.dto.ExamSubmissionDto;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final AnswerRepository answerRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final AttentionLogRepository attentionLogRepository;

    public List<Exam> getExamsByCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        return examRepository.findByCourse(course);
    }

    public Exam getExamById(Long examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
    }

    @Transactional
    public Exam createExam(Exam exam, Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        exam.setCourse(course);
        if (exam.getQuestions() != null) {
            exam.getQuestions().forEach(q -> q.setExam(exam));
        }
        return examRepository.save(exam);
    }

    @Transactional
    public ExamAttempt startExamAttempt(Long examId, String studentEmail) {
        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        Exam exam = getExamById(examId);

        // Check for existing in-progress attempt
        return attemptRepository.findByStudentAndExamAndStatus(student, exam, ExamAttempt.AttemptStatus.IN_PROGRESS)
                .orElseGet(() -> {
                    ExamAttempt attempt = ExamAttempt.builder()
                            .exam(exam)
                            .student(student)
                            .startTime(LocalDateTime.now())
                            .status(ExamAttempt.AttemptStatus.IN_PROGRESS)
                            .tabSwitchCount(0)
                            .averageAttentionScore(null) // nothing measured yet
                            .score(0)
                            .maxScore(exam.getQuestions().stream().mapToInt(q -> q.getMarks() != null ? q.getMarks() : 1).sum())
                            .build();
                    return attemptRepository.save(attempt);
                });
    }

    @Transactional
    public ExamAttempt submitExamAttempt(ExamSubmissionDto dto, String studentEmail) {
        ExamAttempt attempt = attemptRepository.findById(dto.getAttemptId())
                .orElseThrow(() -> new RuntimeException("Attempt not found"));

        if (attempt.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS) {
            return attempt;
        }

        int totalScore = 0;
        if (dto.getAnswers() != null) {
            for (Map.Entry<Long, String> entry : dto.getAnswers().entrySet()) {
                Question question = questionRepository.findById(entry.getKey()).orElse(null);
                if (question != null) {
                    boolean isCorrect = false;
                    int marksObtained = 0;
                    if (question.getType() == Question.QuestionType.MCQ) {
                        isCorrect = question.getCorrectAnswer() != null &&
                                question.getCorrectAnswer().equalsIgnoreCase(entry.getValue());
                        if (isCorrect) {
                            marksObtained = question.getMarks() != null ? question.getMarks() : 1;
                        }
                    } else {
                        // Short answer basic check or credit
                        isCorrect = entry.getValue() != null && !entry.getValue().trim().isEmpty();
                        marksObtained = isCorrect ? (question.getMarks() != null ? question.getMarks() : 1) : 0;
                    }
                    totalScore += marksObtained;

                    Answer answer = Answer.builder()
                            .attempt(attempt)
                            .question(question)
                            .selectedOptionOrText(entry.getValue())
                            .isCorrect(isCorrect)
                            .marksObtained(marksObtained)
                            .build();
                    answerRepository.save(answer);
                }
            }
        }

        attempt.setScore(totalScore);
        attempt.setEndTime(LocalDateTime.now());
        attempt.setTabSwitchCount(dto.getTabSwitchCount() != null ? dto.getTabSwitchCount() : attempt.getTabSwitchCount());

        // Average attention is recomputed from the attention logs this server
        // recorded, not read from the submission body. The browser under audit
        // must not be the source of its own integrity figure.
        // Null means the vision engine never produced a measurement (models
        // missing, camera denied) — recorded as null, not as a default score.
        Double measuredAverage = attentionLogRepository.averageScoreFor(
                attempt.getStudent(), attempt.getExam().getId(), "EXAM");
        attempt.setAverageAttentionScore(
                measuredAverage == null ? null : Math.round(measuredAverage * 10.0) / 10.0);

        if (attempt.getTabSwitchCount() != null && attempt.getExam().getMaxTabSwitches() != null &&
                attempt.getTabSwitchCount() >= attempt.getExam().getMaxTabSwitches()) {
            attempt.setStatus(ExamAttempt.AttemptStatus.AUTO_SUBMITTED_VIOLATION);
        } else {
            attempt.setStatus(ExamAttempt.AttemptStatus.SUBMITTED);
        }

        return attemptRepository.save(attempt);
    }

    public List<ExamAttempt> getStudentAttempts(String studentEmail) {
        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        return attemptRepository.findByStudent(student);
    }

    public List<ExamAttempt> getExamAttemptsForTeacher(Long examId) {
        Exam exam = getExamById(examId);
        return attemptRepository.findByExam(exam);
    }
}
