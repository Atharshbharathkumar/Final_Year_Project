package com.lms.service;

import com.lms.dto.AcademicDtos;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Course cards, coursework, exams, campus events and the credits wallet.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AcademicService {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME_LABEL = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);
    private static final int CREDIT_TARGET = 60;

    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final CampusEventRepository eventRepository;
    private final CreditActivityRepository creditRepository;
    private final UserRepository userRepository;
    private final AnalyticsService analytics;
    private final NotificationService notificationService;

    // ─────────────────────────────── courses ──────────────────────────────────

    /** Courses a student is enrolled in, with their own progress and grade. */
    public List<AcademicDtos.CourseCard> coursesForStudent(User student) {
        return analytics.coursesFor(student).stream()
                .map(course -> toCard(course, student))
                .toList();
    }

    /** Courses a teacher owns; progress is the cohort mean. */
    public List<AcademicDtos.CourseCard> coursesForTeacher(User teacher) {
        return courseRepository.findByTeacher(teacher).stream()
                .map(course -> toCard(course, null))
                .toList();
    }

    public List<AcademicDtos.CourseCard> allCourses() {
        return courseRepository.findAll().stream().map(c -> toCard(c, null)).toList();
    }

    private AcademicDtos.CourseCard toCard(Course course, User student) {
        List<Enrollment> enrolments = enrollmentRepository.findByCourse(course);

        int progress;
        String grade;
        if (student != null) {
            progress = analytics.courseProgress(student, course);
            grade = analytics.letterGrade(analytics.courseScorePercent(student, course));
        } else if (enrolments.isEmpty()) {
            progress = 0;
            grade = "—";
        } else {
            progress = (int) Math.round(enrolments.stream()
                    .mapToInt(e -> analytics.courseProgress(e.getStudent(), course))
                    .average().orElse(0));
            grade = analytics.letterGrade((int) Math.round(enrolments.stream()
                    .mapToInt(e -> analytics.courseScorePercent(e.getStudent(), course))
                    .average().orElse(0)));
        }

        return AcademicDtos.CourseCard.builder()
                .id(course.getId())
                .name(course.getTitle())
                .code(course.getCourseCode())
                .description(course.getDescription())
                .instructor(course.getTeacher() != null ? course.getTeacher().getFullName() : "Unassigned")
                .progress(progress)
                .enrolled((long) enrolments.size())
                .grade(grade)
                .semester(course.getSemester())
                .credits(course.getCreditHours())
                .color(course.getColor())
                .icon(course.getIcon())
                .build();
    }

    // ───────────────────────────── assignments ────────────────────────────────

    public List<AcademicDtos.AssignmentCard> assignmentsForStudent(User student) {
        Map<Long, Submission> submissions = submissionRepository.findByStudent(student).stream()
                .collect(Collectors.toMap(s -> s.getAssignment().getId(), s -> s, (a, b) -> a));

        return analytics.assignmentsFor(student).stream()
                .map(a -> toCard(a, submissions.get(a.getId())))
                .toList();
    }

    /** Teacher view: one card per assignment with cohort submission counts folded in. */
    public List<AcademicDtos.AssignmentCard> assignmentsForTeacher(User teacher) {
        List<Course> owned = courseRepository.findByTeacher(teacher);
        if (owned.isEmpty()) return List.of();

        return assignmentRepository.findByCourseInOrderByDueDateAsc(owned).stream().map(a -> {
            List<Submission> subs = submissionRepository.findByAssignment(a);
            long graded = subs.stream().filter(s -> s.getStatus() == Submission.Status.GRADED).count();
            long submitted = subs.stream().filter(s -> s.getStatus() == Submission.Status.SUBMITTED).count();

            String status;
            if (subs.isEmpty()) status = "pending";
            else if (graded == subs.size()) status = "graded";
            else if (submitted > 0) status = "submitted";
            else status = "in-progress";

            AcademicDtos.AssignmentCard card = toCard(a, null);
            card.setStatus(status);
            card.setFeedback(submitted + " awaiting review · " + graded + " graded");
            return card;
        }).toList();
    }

    private AcademicDtos.AssignmentCard toCard(Assignment a, Submission submission) {
        Submission.Status status = submission == null ? Submission.Status.PENDING : submission.getStatus();
        return AcademicDtos.AssignmentCard.builder()
                .id(a.getId())
                .title(a.getTitle())
                .course(a.getCourse() != null ? a.getCourse().getTitle() : "—")
                .courseId(a.getCourse() != null ? a.getCourse().getId() : null)
                .description(a.getDescription())
                .dueDate(a.getDueDate() != null ? a.getDueDate().toLocalDate().format(ISO_DATE) : null)
                .dueDateTime(a.getDueDate() != null ? a.getDueDate().toString() : null)
                .status(statusSlug(status))
                .priority(a.getPriority() != null ? a.getPriority().name().toLowerCase(Locale.ENGLISH) : "medium")
                .points(a.getPoints())
                .grade(submission != null ? submission.getGrade() : null)
                .feedback(submission != null ? submission.getFeedback() : null)
                .submittedOn(submission != null && submission.getSubmittedAt() != null
                        ? submission.getSubmittedAt().toLocalDate().format(ISO_DATE) : null)
                .build();
    }

    private String statusSlug(Submission.Status status) {
        return switch (status) {
            case IN_PROGRESS -> "in-progress";
            case SUBMITTED -> "submitted";
            case GRADED -> "graded";
            case PENDING -> "pending";
        };
    }

    @Transactional
    public AcademicDtos.AssignmentCard startAssignment(Long assignmentId, User student) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found: " + assignmentId));

        Submission submission = submissionRepository.findByAssignmentAndStudent(assignment, student)
                .orElseGet(() -> Submission.builder()
                        .assignment(assignment)
                        .student(student)
                        .status(Submission.Status.PENDING)
                        .build());

        if (submission.getStatus() == Submission.Status.SUBMITTED || submission.getStatus() == Submission.Status.GRADED) {
            return toCard(assignment, submission);
        }

        submission.setStatus(Submission.Status.IN_PROGRESS);
        if (submission.getStartedAt() == null) submission.setStartedAt(LocalDateTime.now());
        return toCard(assignment, submissionRepository.save(submission));
    }

    @Transactional
    public AcademicDtos.AssignmentCard submitAssignment(Long assignmentId, User student, String fileName) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found: " + assignmentId));

        Submission submission = submissionRepository.findByAssignmentAndStudent(assignment, student)
                .orElseGet(() -> Submission.builder()
                        .assignment(assignment)
                        .student(student)
                        .startedAt(LocalDateTime.now())
                        .build());

        submission.setStatus(Submission.Status.SUBMITTED);
        submission.setSubmittedAt(LocalDateTime.now());
        submission.setFileName(fileName != null && !fileName.isBlank() ? fileName : "submission.pdf");
        return toCard(assignment, submissionRepository.save(submission));
    }

    // ─────────────────────────── teacher authoring ────────────────────────────

    /** Creates an assignment on a course the caller owns. */
    @Transactional
    public AcademicDtos.AssignmentCard createAssignment(AcademicDtos.CreateAssignmentRequest request, User teacher) {
        Course course = courseRepository.findById(request.getCourseId())
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + request.getCourseId()));
        requireOwnership(course, teacher);

        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("An assignment needs a title.");
        }
        if (request.getDueDate() == null || request.getDueDate().isBlank()) {
            throw new IllegalArgumentException("An assignment needs a due date.");
        }

        LocalDate due;
        try {
            due = LocalDate.parse(request.getDueDate());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Due date must be in yyyy-MM-dd format.");
        }

        Assignment.Priority priority;
        try {
            priority = request.getPriority() == null
                    ? Assignment.Priority.MEDIUM
                    : Assignment.Priority.valueOf(request.getPriority().toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Priority must be LOW, MEDIUM or HIGH.");
        }

        Assignment saved = assignmentRepository.save(Assignment.builder()
                .course(course)
                .title(request.getTitle().trim())
                .description(request.getDescription())
                .dueDate(due.atTime(23, 59))
                .points(request.getPoints() == null || request.getPoints() <= 0 ? 100 : request.getPoints())
                .priority(priority)
                .build());

        // Everyone on the course should learn about new work without a refresh.
        enrollmentRepository.findByCourse(course).forEach(enrolment ->
                notificationService.push(enrolment.getStudent(),
                        "New assignment posted",
                        saved.getTitle() + " for " + course.getTitle() + " is due " + due + ".",
                        "info"));

        return toCard(saved, null);
    }

    @Transactional
    public AcademicDtos.CourseCard createCourse(AcademicDtos.CreateCourseRequest request, User teacher) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("A course needs a title.");
        }
        if (request.getCourseCode() == null || request.getCourseCode().isBlank()) {
            throw new IllegalArgumentException("A course needs a course code.");
        }
        String code = request.getCourseCode().trim().toUpperCase(Locale.ENGLISH);
        if (courseRepository.findByCourseCode(code).isPresent()) {
            throw new IllegalArgumentException("A course with code " + code + " already exists.");
        }

        Course saved = courseRepository.save(Course.builder()
                .title(request.getTitle().trim())
                .courseCode(code)
                .description(request.getDescription())
                .teacher(teacher)
                .color(request.getColor() == null || request.getColor().isBlank() ? "#6366f1" : request.getColor())
                .icon(request.getIcon() == null || request.getIcon().isBlank() ? "📘" : request.getIcon())
                .creditHours(request.getCreditHours() == null ? 3 : request.getCreditHours())
                .semester(request.getSemester() == null || request.getSemester().isBlank()
                        ? "Semester " + LocalDate.now().getYear() : request.getSemester())
                .totalSessions(request.getTotalSessions() == null ? 16 : request.getTotalSessions())
                .build());

        return toCard(saved, null);
    }

    // ──────────────────────────────── grading ─────────────────────────────────

    /** Submissions awaiting a mark across every course the caller owns. */
    @Transactional(readOnly = true)
    public List<AcademicDtos.SubmissionCard> gradingQueue(User teacher, boolean includeGraded) {
        List<Course> owned = teacher.getRole() == User.Role.ADMIN
                ? courseRepository.findAll()
                : courseRepository.findByTeacher(teacher);
        if (owned.isEmpty()) return List.of();

        List<Assignment> assignments = assignmentRepository.findByCourseInOrderByDueDateAsc(owned);
        if (assignments.isEmpty()) return List.of();

        return submissionRepository.findByAssignmentIn(assignments).stream()
                .filter(s -> s.getStatus() == Submission.Status.SUBMITTED
                        || (includeGraded && s.getStatus() == Submission.Status.GRADED))
                .sorted(Comparator
                        .comparing((Submission s) -> s.getStatus() == Submission.Status.SUBMITTED ? 0 : 1)
                        .thenComparing(s -> s.getSubmittedAt() == null ? LocalDateTime.MIN : s.getSubmittedAt(),
                                Comparator.reverseOrder()))
                .map(this::toSubmissionCard)
                .toList();
    }

    /**
     * Records a mark. This is the write that closes the teaching loop: the grade
     * feeds straight back into GPA and engagement via AnalyticsService.
     */
    @Transactional
    public AcademicDtos.SubmissionCard gradeSubmission(Long submissionId, AcademicDtos.GradeRequest request, User teacher) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found: " + submissionId));

        Course course = submission.getAssignment().getCourse();
        requireOwnership(course, teacher);

        if (submission.getStatus() != Submission.Status.SUBMITTED
                && submission.getStatus() != Submission.Status.GRADED) {
            throw new IllegalArgumentException("Only submitted work can be graded.");
        }

        int max = submission.getAssignment().getPoints() == null ? 100 : submission.getAssignment().getPoints();
        if (request.getGrade() == null || request.getGrade() < 0 || request.getGrade() > max) {
            throw new IllegalArgumentException("Mark must be between 0 and " + max + ".");
        }

        submission.setGrade(request.getGrade());
        submission.setFeedback(request.getFeedback());
        submission.setStatus(Submission.Status.GRADED);
        submission.setGradedAt(LocalDateTime.now());
        Submission saved = submissionRepository.save(submission);

        notificationService.push(submission.getStudent(),
                "Assignment graded",
                submission.getAssignment().getTitle() + ": " + request.getGrade() + "/" + max + ".",
                "success");

        return toSubmissionCard(saved);
    }

    private AcademicDtos.SubmissionCard toSubmissionCard(Submission s) {
        Assignment a = s.getAssignment();
        User student = s.getStudent();
        boolean late = s.getSubmittedAt() != null && a.getDueDate() != null
                && s.getSubmittedAt().isAfter(a.getDueDate());

        return AcademicDtos.SubmissionCard.builder()
                .id(s.getId())
                .assignmentId(a.getId())
                .assignmentTitle(a.getTitle())
                .courseName(a.getCourse().getTitle())
                .courseCode(a.getCourse().getCourseCode())
                .studentId(student.getId())
                .studentName(student.getFullName())
                .studentEmail(student.getEmail())
                .studentAvatar(student.getAvatarEmoji() != null ? student.getAvatarEmoji() : "🎓")
                .status(statusSlug(s.getStatus()))
                .points(a.getPoints())
                .grade(s.getGrade())
                .feedback(s.getFeedback())
                .fileName(s.getFileName())
                .submittedAt(s.getSubmittedAt() != null ? s.getSubmittedAt().toLocalDate().format(ISO_DATE) : null)
                .late(late)
                .build();
    }

    /** A teacher may only touch courses they own; admins may touch any. */
    private void requireOwnership(Course course, User caller) {
        if (caller.getRole() == User.Role.ADMIN) return;
        if (course.getTeacher() == null || !course.getTeacher().getId().equals(caller.getId())) {
            throw new IllegalArgumentException("You do not teach this course.");
        }
    }

    // ──────────────────────────────── exams ───────────────────────────────────

    public List<AcademicDtos.ExamCard> examsForStudent(User student) {
        List<Course> courses = analytics.coursesFor(student);
        if (courses.isEmpty()) return List.of();

        Map<Long, ExamAttempt> attempts = attemptRepository.findByStudent(student).stream()
                .collect(Collectors.toMap(a -> a.getExam().getId(), a -> a, (a, b) -> a));

        return examRepository.findByCourseInOrderByStartTimeAsc(courses).stream().map(exam -> {
            ExamAttempt attempt = attempts.get(exam.getId());
            boolean done = attempt != null && attempt.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS;
            Integer score = null;
            if (done && attempt.getMaxScore() != null && attempt.getMaxScore() > 0) {
                score = (int) Math.round(100.0 * (attempt.getScore() == null ? 0 : attempt.getScore()) / attempt.getMaxScore());
            }
            return AcademicDtos.ExamCard.builder()
                    .id(exam.getId())
                    .title(exam.getTitle())
                    .course(exam.getCourse().getTitle())
                    .date(exam.getStartTime() != null ? exam.getStartTime().toLocalDate().format(ISO_DATE) : null)
                    .time(exam.getStartTime() != null ? exam.getStartTime().format(TIME_LABEL) : null)
                    .duration(exam.getDurationMinutes() != null ? exam.getDurationMinutes() + " minutes" : "—")
                    .type(exam.getDurationMinutes() != null && exam.getDurationMinutes() >= 60 ? "Mid-Term" : "Quiz")
                    .status(done ? "completed" : "upcoming")
                    .score(score)
                    .build();
        }).toList();
    }

    // ──────────────────────────────── events ──────────────────────────────────

    public List<AcademicDtos.EventCard> upcomingEvents() {
        List<CampusEvent> events = eventRepository.findByStartsAtAfterOrderByStartsAtAsc(LocalDateTime.now());
        if (events.isEmpty()) events = eventRepository.findAllByOrderByStartsAtAsc();
        return events.stream().map(e -> AcademicDtos.EventCard.builder()
                .id(e.getId())
                .title(e.getTitle())
                .date(e.getStartsAt() != null ? e.getStartsAt().toLocalDate().format(ISO_DATE) : null)
                .time(e.getStartsAt() != null ? e.getStartsAt().format(TIME_LABEL) : null)
                .type(e.getType())
                .credits(e.getCredits())
                .location(e.getLocation())
                .build()).toList();
    }

    // ──────────────────────────────── credits ─────────────────────────────────

    private static final Map<CreditActivity.Category, String[]> CATEGORY_STYLE = Map.of(
            CreditActivity.Category.WORKSHOP, new String[]{"Workshops", "🔧", "#6366f1"},
            CreditActivity.Category.COMPETITION, new String[]{"Competitions", "🏆", "#8b5cf6"},
            CreditActivity.Category.CERTIFICATION, new String[]{"Certifications", "📜", "#06b6d4"},
            CreditActivity.Category.RESEARCH, new String[]{"Research", "🔬", "#10b981"},
            CreditActivity.Category.VOLUNTEERING, new String[]{"Volunteering", "🤝", "#f59e0b"},
            CreditActivity.Category.CLUB, new String[]{"Clubs", "🎭", "#ec4899"},
            CreditActivity.Category.TIMELY_SUBMISSION, new String[]{"Timely Submissions", "⏰", "#14b8a6"}
    );

    public AcademicDtos.CreditsWallet creditsWallet(User student) {
        List<CreditActivity> activities = creditRepository.findByStudentOrderByAwardedOnDesc(student);
        int total = activities.stream().mapToInt(a -> a.getCredits() == null ? 0 : a.getCredits()).sum();

        Map<CreditActivity.Category, Integer> byCategory = new EnumMap<>(CreditActivity.Category.class);
        for (CreditActivity a : activities) {
            byCategory.merge(a.getCategory(), a.getCredits() == null ? 0 : a.getCredits(), Integer::sum);
        }

        List<AcademicDtos.CreditCategory> categories = Arrays.stream(CreditActivity.Category.values())
                .map(cat -> {
                    String[] style = CATEGORY_STYLE.get(cat);
                    return AcademicDtos.CreditCategory.builder()
                            .name(style[0])
                            .icon(style[1])
                            .color(style[2])
                            .earned(byCategory.getOrDefault(cat, 0))
                            .categoryMax(15)
                            .build();
                }).toList();

        List<AcademicDtos.Achievement> achievements = activities.stream()
                .map(a -> AcademicDtos.Achievement.builder()
                        .title(a.getTitle())
                        .date(a.getAwardedOn() != null ? a.getAwardedOn().format(ISO_DATE) : null)
                        .credits(a.getCredits())
                        .type(CATEGORY_STYLE.get(a.getCategory())[0].toLowerCase(Locale.ENGLISH))
                        .build())
                .toList();

        // One scholar level for every 12 credits banked.
        int level = Math.max(1, total / 12 + 1);

        return AcademicDtos.CreditsWallet.builder()
                .total(total)
                .target(CREDIT_TARGET)
                .level(level)
                .levelLabel("Level " + level + " Scholar")
                .remainingForHonors(Math.max(0, CREDIT_TARGET - total))
                .categories(categories)
                .achievements(achievements)
                .build();
    }

    public int totalCredits(User student) {
        return creditRepository.findByStudentOrderByAwardedOnDesc(student).stream()
                .mapToInt(a -> a.getCredits() == null ? 0 : a.getCredits())
                .sum();
    }

    /** Courses whose syllabus coverage has reached 100% for this student. */
    public long completedCourseCount(User student) {
        return analytics.coursesFor(student).stream()
                .filter(c -> analytics.courseProgress(student, c) >= 100)
                .count();
    }

    public String cohortLabel(User student) {
        String dept = student.getDepartment() != null ? student.getDepartment().getName() : "General";
        return dept + (student.getStudyYear() != null ? " · Year " + student.getStudyYear() : "");
    }

    /** Human "2 hours ago" style label used by the notification list. */
    public static String relativeTime(LocalDateTime when) {
        if (when == null) return "";
        Duration since = Duration.between(when, LocalDateTime.now());
        long minutes = since.toMinutes();
        if (minutes < 1) return "Just now";
        if (minutes < 60) return minutes + (minutes == 1 ? " minute ago" : " minutes ago");
        long hours = since.toHours();
        if (hours < 24) return hours + (hours == 1 ? " hour ago" : " hours ago");
        long days = since.toDays();
        if (days < 30) return days + (days == 1 ? " day ago" : " days ago");
        return when.toLocalDate().format(ISO_DATE);
    }

    public User requireStudent(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + id));
    }

    public LocalDate today() {
        return LocalDate.now();
    }
}