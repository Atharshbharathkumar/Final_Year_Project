package com.lms.service;

import com.lms.dto.ExamDtos;
import com.lms.dto.ExamSubmissionDto;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Sitting and marking proctored exams.
 * <p>
 * Two rules run through this whole class. Candidates never receive the answer
 * key, and every attempt operation verifies the attempt belongs to the caller —
 * an attempt id in a URL is not authorisation.
 */
@Service
@RequiredArgsConstructor
public class ExamService {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final AnswerRepository answerRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final MonitoringService monitoringService;
    private final AiIntelligenceService aiIntelligenceService;

    // ──────────────────────────────── reads ──────────────────────────────────

    public List<Exam> getExamsByCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));
        return examRepository.findByCourse(course);
    }

    @Transactional(readOnly = true)
    public Exam getExamById(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        exam.getQuestions().size(); // initialise before the session closes
        return exam;
    }

    /**
     * The paper as a candidate sees it. Enrolment is checked here rather than in
     * the controller so no caller can bypass it.
     */
    @Transactional(readOnly = true)
    public ExamDtos.ExamPaper getPaper(Long examId, User student) {
        Exam exam = getExamById(examId);

        boolean enrolled = enrollmentRepository.findByStudentAndCourse(student, exam.getCourse()).isPresent();
        boolean staff = student.getRole() == User.Role.TEACHER || student.getRole() == User.Role.ADMIN;
        if (!enrolled && !staff) {
            throw new IllegalArgumentException("You are not enrolled in the course this exam belongs to.");
        }

        List<Question> questions = questionRepository.findByExam(exam);
        int totalMarks = questions.stream().mapToInt(q -> q.getMarks() == null ? 1 : q.getMarks()).sum();

        return ExamDtos.ExamPaper.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .description(exam.getDescription())
                .courseName(exam.getCourse().getTitle())
                .courseCode(exam.getCourse().getCourseCode())
                .durationMinutes(exam.getDurationMinutes())
                .lockdownEnabled(Boolean.TRUE.equals(exam.getLockdownEnabled()))
                .cameraRequired(Boolean.TRUE.equals(exam.getCameraRequired()))
                .maxTabSwitches(exam.getMaxTabSwitches())
                .totalMarks(totalMarks)
                .questionCount(questions.size())
                .questions(questions.stream().map(this::toPaperQuestion).toList())
                .build();
    }

    private ExamDtos.PaperQuestion toPaperQuestion(Question q) {
        return ExamDtos.PaperQuestion.builder()
                .id(q.getId())
                .questionText(q.getQuestionText())
                .type(q.getType())
                .optionA(q.getOptionA())
                .optionB(q.getOptionB())
                .optionC(q.getOptionC())
                .optionD(q.getOptionD())
                .marks(q.getMarks())
                .build();
    }

    // ─────────────────────────────── attempts ────────────────────────────────

    /**
     * Starts an attempt, or resumes the one already in progress. Resuming is the
     * normal path after a refresh, so it must not reset the clock.
     */
    @Transactional
    public ExamDtos.AttemptState startAttempt(Long examId, User student) {
        Exam exam = getExamById(examId);

        if (enrollmentRepository.findByStudentAndCourse(student, exam.getCourse()).isEmpty()) {
            throw new IllegalArgumentException("You are not enrolled in the course this exam belongs to.");
        }
        if (exam.getEndTime() != null && LocalDateTime.now().isAfter(exam.getEndTime())) {
            throw new IllegalArgumentException("This exam has closed.");
        }

        Optional<ExamAttempt> existing =
                attemptRepository.findByStudentAndExamAndStatus(student, exam, ExamAttempt.AttemptStatus.IN_PROGRESS);
        if (existing.isPresent()) {
            return toState(existing.get());
        }

        // A finished attempt is final — one sitting per candidate.
        boolean alreadySat = attemptRepository.findByStudent(student).stream()
                .anyMatch(a -> a.getExam().getId().equals(examId)
                        && a.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS);
        if (alreadySat) {
            throw new IllegalArgumentException("You have already submitted this exam.");
        }

        List<Question> questions = questionRepository.findByExam(exam);
        int maxScore = questions.stream().mapToInt(q -> q.getMarks() == null ? 1 : q.getMarks()).sum();

        ExamAttempt attempt = attemptRepository.save(ExamAttempt.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now())
                .status(ExamAttempt.AttemptStatus.IN_PROGRESS)
                .tabSwitchCount(0)
                .averageAttentionScore(100.0)
                .score(0)
                .maxScore(maxScore)
                .build());

        return toState(attempt);
    }

    /** Current state of an attempt, auto-submitting it if the clock has run out. */
    @Transactional
    public ExamDtos.AttemptState getAttemptState(Long attemptId, User caller) {
        ExamAttempt attempt = requireOwnedAttempt(attemptId, caller);

        if (attempt.getStatus() == ExamAttempt.AttemptStatus.IN_PROGRESS && secondsRemaining(attempt) <= 0) {
            finalise(attempt, ExamAttempt.AttemptStatus.SUBMITTED);
        }
        return toState(attempt);
    }

    /**
     * Persists one answer as the candidate works, so a refresh or a crash does
     * not lose the paper. Marks are not computed until submission.
     */
    @Transactional
    public void saveAnswer(Long attemptId, User caller, Long questionId, String answer) {
        ExamAttempt attempt = requireOwnedAttempt(attemptId, caller);
        if (attempt.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("This attempt has already been submitted.");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));
        if (!question.getExam().getId().equals(attempt.getExam().getId())) {
            throw new IllegalArgumentException("That question is not part of this exam.");
        }

        Answer row = answerRepository.findByAttemptAndQuestion(attempt, question)
                .orElseGet(() -> Answer.builder().attempt(attempt).question(question).build());
        row.setSelectedOptionOrText(answer);
        answerRepository.save(row);
    }

    /**
     * Records that the candidate left the exam window. The count is kept on the
     * server: a client that simply declines to report switches cannot lower it,
     * and reaching the limit terminates the attempt here rather than in the UI.
     */
    @Transactional
    public ExamDtos.TabSwitchResult registerTabSwitch(Long attemptId, User caller) {
        ExamAttempt attempt = requireOwnedAttempt(attemptId, caller);

        if (attempt.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS) {
            return ExamDtos.TabSwitchResult.builder()
                    .tabSwitchCount(attempt.getTabSwitchCount())
                    .maxTabSwitches(attempt.getExam().getMaxTabSwitches())
                    .terminated(true)
                    .message("This attempt is already closed.")
                    .build();
        }

        int count = (attempt.getTabSwitchCount() == null ? 0 : attempt.getTabSwitchCount()) + 1;
        attempt.setTabSwitchCount(count);
        attemptRepository.save(attempt);

        Integer limit = attempt.getExam().getMaxTabSwitches();
        boolean terminate = limit != null && count >= limit;

        monitoringService.raiseExamAlert(
                attempt.getStudent(), attempt.getId(),
                Alert.AlertType.TAB_SWITCH,
                terminate ? Alert.Severity.CRITICAL : Alert.Severity.HIGH,
                attempt.getStudent().getFullName() + " switched away from the exam window ("
                        + count + (limit != null ? "/" + limit : "") + ").");

        if (terminate) {
            finalise(attempt, ExamAttempt.AttemptStatus.AUTO_SUBMITTED_VIOLATION);
        }

        return ExamDtos.TabSwitchResult.builder()
                .tabSwitchCount(count)
                .maxTabSwitches(limit)
                .terminated(terminate)
                .message(terminate
                        ? "Tab switch limit reached — your exam has been submitted automatically."
                        : "Leaving the exam window has been recorded and reported to your invigilator.")
                .build();
    }

    /** Candidate-initiated submission. */
    @Transactional
    public ExamDtos.AttemptResult submit(ExamSubmissionDto dto, User caller) {
        ExamAttempt attempt = requireOwnedAttempt(dto.getAttemptId(), caller);

        if (attempt.getStatus() == ExamAttempt.AttemptStatus.IN_PROGRESS) {
            if (dto.getAnswers() != null) {
                dto.getAnswers().forEach((questionId, answer) -> {
                    try {
                        saveAnswer(attempt.getId(), caller, questionId, answer);
                    } catch (IllegalArgumentException ignored) {
                        // A stale question id from the client must not void the paper.
                    }
                });
            }
            if (dto.getAverageAttentionScore() != null) {
                attempt.setAverageAttentionScore(dto.getAverageAttentionScore());
            }
            finalise(attempt, ExamAttempt.AttemptStatus.SUBMITTED);
        }
        return buildResult(attempt);
    }

    /**
     * Marks every saved answer and closes the attempt. MCQs are marked against
     * the key; short answers earn their marks for a non-empty response, which is
     * flagged in the UI as awaiting manual review.
     */
    private void finalise(ExamAttempt attempt, ExamAttempt.AttemptStatus status) {
        int total = 0;

        for (Answer answer : answerRepository.findByAttempt(attempt)) {
            Question question = answer.getQuestion();
            String given = answer.getSelectedOptionOrText();
            int marks = question.getMarks() == null ? 1 : question.getMarks();

            boolean correct;
            int awarded;
            if (question.getType() == Question.QuestionType.MCQ) {
                correct = question.getCorrectAnswer() != null
                        && question.getCorrectAnswer().equalsIgnoreCase(given == null ? "" : given.trim());
                awarded = correct ? marks : 0;
            } else {
                correct = given != null && !given.isBlank();
                awarded = correct ? marks : 0;
            }

            answer.setIsCorrect(correct);
            answer.setMarksObtained(awarded);
            answerRepository.save(answer);
            total += awarded;
        }

        attempt.setScore(total);
        attempt.setEndTime(LocalDateTime.now());

        // The violation status wins: it records why the attempt ended.
        Integer limit = attempt.getExam().getMaxTabSwitches();
        boolean violated = limit != null && attempt.getTabSwitchCount() != null && attempt.getTabSwitchCount() >= limit;
        attempt.setStatus(violated ? ExamAttempt.AttemptStatus.AUTO_SUBMITTED_VIOLATION : status);

        attemptRepository.save(attempt);
    }

    @Transactional(readOnly = true)
    public ExamDtos.AttemptResult getResult(Long attemptId, User caller) {
        if (attemptId == null) {
            throw new IllegalArgumentException("An attempt id is required.");
        }
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new IllegalArgumentException("Attempt not found: " + attemptId));

        boolean staff = caller.getRole() == User.Role.TEACHER || caller.getRole() == User.Role.ADMIN;
        if (!staff && !attempt.getStudent().getId().equals(caller.getId())) {
            throw new IllegalArgumentException("That attempt does not belong to you.");
        }
        return buildResult(attempt);
    }

    private ExamDtos.AttemptResult buildResult(ExamAttempt attempt) {
        var integrity = aiIntelligenceService.evaluateExamIntegrity(attempt.getId());
        List<Answer> answers = answerRepository.findByAttempt(attempt);
        int questionCount = questionRepository.findByExam(attempt.getExam()).size();
        int max = attempt.getMaxScore() == null || attempt.getMaxScore() == 0 ? 1 : attempt.getMaxScore();

        return ExamDtos.AttemptResult.builder()
                .attemptId(attempt.getId())
                .examTitle(attempt.getExam().getTitle())
                .courseName(attempt.getExam().getCourse().getTitle())
                .studentName(attempt.getStudent().getFullName())
                .score(attempt.getScore())
                .maxScore(attempt.getMaxScore())
                .percentage((int) Math.round(100.0 * (attempt.getScore() == null ? 0 : attempt.getScore()) / max))
                .status(attempt.getStatus().name())
                .tabSwitchCount(attempt.getTabSwitchCount())
                .submittedAt(attempt.getEndTime() != null ? attempt.getEndTime().format(STAMP) : null)
                .questionsAnswered((int) answers.stream()
                        .filter(a -> a.getSelectedOptionOrText() != null && !a.getSelectedOptionOrText().isBlank())
                        .count())
                .questionCount(questionCount)
                .integrityScore(integrity.getIntegrityConfidenceScore())
                .integrityStatus(integrity.getStatus())
                .integrityFlags(integrity.getFlaggedAnomalies())
                .build();
    }

    // ──────────────────────────────── helpers ────────────────────────────────

    private ExamAttempt requireOwnedAttempt(Long attemptId, User caller) {
        if (attemptId == null) {
            throw new IllegalArgumentException("An attempt id is required.");
        }
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new IllegalArgumentException("Attempt not found: " + attemptId));
        if (!attempt.getStudent().getId().equals(caller.getId())) {
            throw new IllegalArgumentException("That attempt does not belong to you.");
        }
        return attempt;
    }

    /** Server-clock time left, bounded by both the duration and the exam window. */
    private long secondsRemaining(ExamAttempt attempt) {
        LocalDateTime deadline = deadline(attempt);
        return Math.max(0, Duration.between(LocalDateTime.now(), deadline).getSeconds());
    }

    private LocalDateTime deadline(ExamAttempt attempt) {
        Exam exam = attempt.getExam();
        int minutes = exam.getDurationMinutes() == null ? 60 : exam.getDurationMinutes();
        LocalDateTime byDuration = attempt.getStartTime().plusMinutes(minutes);
        if (exam.getEndTime() != null && exam.getEndTime().isBefore(byDuration)) {
            return exam.getEndTime();
        }
        return byDuration;
    }

    private ExamDtos.AttemptState toState(ExamAttempt attempt) {
        Map<Long, String> saved = answerRepository.findByAttempt(attempt).stream()
                .filter(a -> a.getSelectedOptionOrText() != null)
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), Answer::getSelectedOptionOrText, (a, b) -> a));

        long remaining = attempt.getStatus() == ExamAttempt.AttemptStatus.IN_PROGRESS ? secondsRemaining(attempt) : 0;

        return ExamDtos.AttemptState.builder()
                .attemptId(attempt.getId())
                .examId(attempt.getExam().getId())
                .status(attempt.getStatus().name())
                .startedAt(attempt.getStartTime().toString())
                .deadline(deadline(attempt).toString())
                .secondsRemaining(remaining)
                .tabSwitchCount(attempt.getTabSwitchCount())
                .maxTabSwitches(attempt.getExam().getMaxTabSwitches())
                .expired(remaining <= 0 && attempt.getStatus() == ExamAttempt.AttemptStatus.IN_PROGRESS)
                .savedAnswers(saved)
                .build();
    }

    // ───────────────────────────── teacher side ──────────────────────────────

    @Transactional
    public Exam createExam(Exam exam, Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));
        exam.setCourse(course);
        if (exam.getQuestions() != null) {
            exam.getQuestions().forEach(q -> q.setExam(exam));
        }
        return examRepository.save(exam);
    }

    /**
     * Returned as DTOs rather than entities: serialising an ExamAttempt drags in
     * the exam and its lazily-loaded question list, which blows up outside the
     * persistence session.
     */
    @Transactional(readOnly = true)
    public List<ExamDtos.AttemptResult> getStudentAttempts(String studentEmail) {
        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new IllegalArgumentException("Student not found"));
        return attemptRepository.findByStudent(student).stream().map(this::buildResult).toList();
    }

    /** This candidate's attempt at one exam, if they have started it. */
    @Transactional(readOnly = true)
    public Optional<ExamDtos.AttemptState> findMyAttempt(Long examId, User student) {
        return attemptRepository.findByStudent(student).stream()
                .filter(a -> a.getExam().getId().equals(examId))
                .max(Comparator.comparing(ExamAttempt::getStartTime))
                .map(this::toState);
    }

    @Transactional(readOnly = true)
    public List<ExamDtos.AttemptResult> getExamAttemptsForTeacher(Long examId) {
        Exam exam = getExamById(examId);
        return attemptRepository.findByExam(exam).stream().map(this::buildResult).toList();
    }
}