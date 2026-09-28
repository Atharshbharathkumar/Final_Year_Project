package com.lms.config;

import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Seeds a complete, self-consistent teaching term so every screen has real data
 * to derive from: departments, staff, cohorts, coursework, attendance, proctoring
 * telemetry, alerts and campus activity.
 * <p>
 * Values are generated from a fixed random seed, so the demo is identical on
 * every fresh database while still carrying realistic variance.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "lms.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    /** Fixed seed keeps the generated term reproducible across rebuilds. */
    private static final Random RNG = new Random(20260812L);
    private static final String DEFAULT_PASSWORD = "password";
    private static final int TERM_WEEKS = 8;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final CampusEventRepository eventRepository;
    private final NotificationRepository notificationRepository;
    private final CreditActivityRepository creditRepository;
    private final PasswordEncoder passwordEncoder;

    /** How a seeded student behaves; drives every generated signal. */
    private enum Profile {
        EXCELLENT(93, 0.97, 0.95, 6),
        STRONG(85, 0.93, 0.85, 4),
        AVERAGE(72, 0.86, 0.62, 2),
        AT_RISK(47, 0.61, 0.30, 0);

        final int attentionBase;
        final double attendanceRate;
        final double completionRate;
        final int chatMessages;

        Profile(int attentionBase, double attendanceRate, double completionRate, int chatMessages) {
            this.attentionBase = attentionBase;
            this.attendanceRate = attendanceRate;
            this.completionRate = completionRate;
            this.chatMessages = chatMessages;
        }
    }

    private record Seeded(User user, Profile profile) {
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Database already seeded — skipping data initialisation.");
            return;
        }
        log.info("Seeding demonstration term…");

        Map<String, Department> departments = seedDepartments();
        List<User> teachers = seedTeachers(departments);
        List<Seeded> students = seedStudents(departments);
        seedParentAndAdmin(students.get(0).user());

        List<Course> courses = seedCourses(teachers, departments);
        seedEnrolments(students, courses);
        seedAttendance(students, courses);
        List<Assignment> assignments = seedAssignments(courses);
        seedSubmissions(students, assignments);
        Exam exam = seedExam(courses.get(1));
        seedExamAttempts(students, exam);
        seedOpenQuiz(courses.get(0));

        List<ClassroomSession> sessions = seedSessions(courses, teachers);
        seedChat(sessions.get(sessions.size() - 1), students, teachers.get(0));
        seedAttentionAndAlerts(students, sessions);

        seedEvents();
        seedCredits(students);
        seedNotifications(students, teachers);

        log.info("Seed complete: {} students, {} courses, {} attention readings.",
                students.size(), courses.size(), attentionLogRepository.count());
    }

    // ───────────────────────────── organisation ───────────────────────────────

    private Map<String, Department> seedDepartments() {
        Map<String, Department> map = new LinkedHashMap<>();
        record Dept(String code, String name) {
        }
        List<Dept> defs = List.of(
                new Dept("CSE", "Computer Science"),
                new Dept("ECE", "Electronics & Communication"),
                new Dept("MECH", "Mechanical"),
                new Dept("CIVIL", "Civil Engineering"),
                new Dept("IT", "Information Technology"),
                new Dept("EEE", "Electrical")
        );
        for (Dept d : defs) {
            map.put(d.code(), departmentRepository.save(
                    Department.builder().code(d.code()).name(d.name()).build()));
        }
        return map;
    }

    private List<User> seedTeachers(Map<String, Department> departments) {
        record Staff(String name, String email, String dept) {
        }
        List<Staff> defs = List.of(
                new Staff("Dr. Priya Sharma", "teacher@edu.in", "CSE"),
                new Staff("Dr. Rajesh Kumar", "rajesh.k@edu.in", "CSE"),
                new Staff("Prof. Anita Singh", "anita.s@edu.in", "CSE"),
                new Staff("Dr. Vikram Patel", "vikram.p@edu.in", "ECE"),
                new Staff("Prof. Sunita Reddy", "sunita.r@edu.in", "IT"),
                new Staff("Dr. Anil Menon", "anil.m@edu.in", "MECH")
        );

        List<User> teachers = new ArrayList<>();
        for (Staff s : defs) {
            teachers.add(userRepository.save(User.builder()
                    .email(s.email())
                    .password(passwordEncoder.encode(DEFAULT_PASSWORD))
                    .fullName(s.name())
                    .role(User.Role.TEACHER)
                    .department(departments.get(s.dept()))
                    .avatarEmoji("👩‍🏫")
                    .avatarUrl(avatar(s.name()))
                    .build()));
        }
        return teachers;
    }

    private List<Seeded> seedStudents(Map<String, Department> departments) {
        record Cohort(String name, String email, String dept, int year, Profile profile, String emoji) {
        }
        List<Cohort> defs = List.of(
                new Cohort("Arun Kumar", "student@edu.in", "CSE", 3, Profile.STRONG, "👨‍🎓"),
                new Cohort("Priya Nair", "priya.n@edu.in", "CSE", 3, Profile.EXCELLENT, "👩‍🎓"),
                new Cohort("Rahul Verma", "rahul.v@edu.in", "CSE", 3, Profile.AT_RISK, "👨‍🎓"),
                new Cohort("Deepa Menon", "deepa.m@edu.in", "CSE", 3, Profile.AVERAGE, "👩‍🎓"),
                new Cohort("Karthik Iyer", "karthik.i@edu.in", "CSE", 3, Profile.STRONG, "👨‍🎓"),
                new Cohort("Ananya Rao", "ananya.r@edu.in", "ECE", 2, Profile.AVERAGE, "👩‍🎓"),
                new Cohort("Siddharth Das", "sid.d@edu.in", "CSE", 3, Profile.AT_RISK, "👨‍🎓"),
                new Cohort("Meera Joshi", "meera.j@edu.in", "CSE", 3, Profile.EXCELLENT, "👩‍🎓"),
                new Cohort("Vikram Shah", "vikram.s@edu.in", "MECH", 2, Profile.AVERAGE, "👨‍🎓"),
                new Cohort("Neha Sharma", "neha.s@edu.in", "IT", 3, Profile.AT_RISK, "👩‍🎓"),
                new Cohort("Rohan Gupta", "rohan.g@edu.in", "IT", 3, Profile.AVERAGE, "👨‍🎓"),
                new Cohort("Sneha Pillai", "sneha.p@edu.in", "CIVIL", 2, Profile.STRONG, "👩‍🎓")
        );

        List<Seeded> students = new ArrayList<>();
        for (int i = 0; i < defs.size(); i++) {
            Cohort c = defs.get(i);
            // Stagger enrolment dates so the admin growth chart has a real slope.
            int monthsAgo = Math.max(0, 7 - (i * 7 / Math.max(1, defs.size() - 1)));
            User saved = userRepository.save(User.builder()
                    .email(c.email())
                    .password(passwordEncoder.encode(DEFAULT_PASSWORD))
                    .fullName(c.name())
                    .role(User.Role.STUDENT)
                    .department(departments.get(c.dept()))
                    .studyYear(c.year())
                    .avatarEmoji(c.emoji())
                    .avatarUrl(avatar(c.name()))
                    .createdAt(LocalDateTime.now().minusMonths(monthsAgo).withDayOfMonth(3))
                    .build());
            students.add(new Seeded(saved, c.profile()));
        }
        return students;
    }

    private void seedParentAndAdmin(User child) {
        userRepository.save(User.builder()
                .email("parent@edu.in")
                .password(passwordEncoder.encode(DEFAULT_PASSWORD))
                .fullName("Ravi Kumar")
                .role(User.Role.PARENT)
                .linkedStudent(child)
                .avatarEmoji("👨‍👦")
                .avatarUrl(avatar("Ravi Kumar"))
                .build());

        userRepository.save(User.builder()
                .email("admin@edu.in")
                .password(passwordEncoder.encode(DEFAULT_PASSWORD))
                .fullName("System Administrator")
                .role(User.Role.ADMIN)
                .avatarEmoji("⚙️")
                .avatarUrl(avatar("Administrator"))
                .build());
    }

    // ──────────────────────────────── academic ────────────────────────────────

    private List<Course> seedCourses(List<User> teachers, Map<String, Department> departments) {
        record Cs(String code, String title, String desc, String colour, String icon, int credits, int teacher) {
        }
        List<Cs> defs = List.of(
                new Cs("CS301", "Data Structures & Algorithms",
                        "Core data structures, complexity analysis, and algorithm design strategies.",
                        "#6366f1", "📊", 4, 0),
                new Cs("CS401", "Machine Learning",
                        "Supervised and unsupervised learning, neural networks and backpropagation.",
                        "#8b5cf6", "🤖", 4, 1),
                new Cs("CS302", "Database Management Systems",
                        "Relational modelling, normalisation, transactions and query optimisation.",
                        "#06b6d4", "🗄️", 3, 2),
                new Cs("CS303", "Computer Networks",
                        "Layered network architecture, TCP/IP, routing and network security.",
                        "#10b981", "🌐", 3, 3),
                new Cs("CS310", "Web Development",
                        "Modern full-stack engineering with React, REST APIs and real-time transport.",
                        "#f59e0b", "💻", 3, 4),
                new Cs("CS402", "Artificial Intelligence",
                        "Search, knowledge representation, computer vision and responsible AI practice.",
                        "#ec4899", "🧠", 4, 5)
        );

        String semester = "Semester " + (LocalDate.now().getMonthValue() >= 7 ? "Odd " : "Even ") + LocalDate.now().getYear();
        List<Course> courses = new ArrayList<>();
        for (Cs c : defs) {
            courses.add(courseRepository.save(Course.builder()
                    .courseCode(c.code())
                    .title(c.title())
                    .description(c.desc())
                    .teacher(teachers.get(c.teacher()))
                    .color(c.colour())
                    .icon(c.icon())
                    .creditHours(c.credits())
                    .semester(semester)
                    .totalSessions(TERM_WEEKS * 2)
                    .build()));
        }
        return courses;
    }

    /**
     * CSE students take the five CSE courses; students from other departments
     * take a smaller shared selection.
     */
    private void seedEnrolments(List<Seeded> students, List<Course> courses) {
        for (Seeded s : students) {
            String dept = s.user().getDepartment().getCode();
            List<Course> enrolIn = "CSE".equals(dept)
                    ? courses
                    : List.of(courses.get(1), courses.get(4), courses.get(5));
            for (Course c : enrolIn) {
                enrollmentRepository.save(Enrollment.builder().student(s.user()).course(c).build());
            }
        }
    }

    /** Two teaching sessions per course per week for the whole term. */
    private void seedAttendance(List<Seeded> students, List<Course> courses) {
        LocalDate termStart = LocalDate.now().minusWeeks(TERM_WEEKS - 1).with(DayOfWeek.MONDAY);

        for (Seeded s : students) {
            List<Course> enrolled = enrollmentRepository.findByStudent(s.user()).stream()
                    .map(Enrollment::getCourse).toList();

            for (Course course : enrolled) {
                for (int week = 0; week < TERM_WEEKS; week++) {
                    for (DayOfWeek day : List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY)) {
                        LocalDate date = termStart.plusWeeks(week).with(day);
                        if (date.isAfter(LocalDate.now())) continue;

                        attendanceRepository.save(AttendanceRecord.builder()
                                .student(s.user())
                                .course(course)
                                .sessionDate(date)
                                .present(RNG.nextDouble() < s.profile().attendanceRate)
                                .build());
                    }
                }
            }
        }
    }

    private List<Assignment> seedAssignments(List<Course> courses) {
        record As(int course, String title, String desc, int daysFromNow, int points, Assignment.Priority priority) {
        }
        List<As> defs = List.of(
                new As(0, "Binary Search Tree Implementation",
                        "Implement insert, delete and balanced traversal with complexity analysis.", 6, 100, Assignment.Priority.HIGH),
                new As(0, "Sorting Algorithm Benchmark",
                        "Benchmark four sorting algorithms and justify the observed complexity curves.", -9, 80, Assignment.Priority.LOW),
                new As(1, "Linear Regression Model",
                        "Train and evaluate a regression model, reporting RMSE against a held-out split.", 8, 150, Assignment.Priority.MEDIUM),
                new As(1, "Neural Network from Scratch",
                        "Build a two-layer network with manual backpropagation — no autograd libraries.", 16, 180, Assignment.Priority.HIGH),
                new As(2, "ER Diagram Design",
                        "Model the given business domain and normalise the schema to third normal form.", -4, 80, Assignment.Priority.LOW),
                new As(3, "TCP/IP Protocol Analysis",
                        "Capture and annotate a full TCP handshake and teardown using a packet analyser.", 10, 120, Assignment.Priority.HIGH),
                new As(4, "React Dashboard Project",
                        "Build a responsive dashboard consuming a REST API with authenticated routes.", 13, 200, Assignment.Priority.MEDIUM),
                new As(5, "Responsible AI Case Study",
                        "Analyse a deployed AI system and evaluate it against fairness and consent criteria.", 20, 140, Assignment.Priority.MEDIUM)
        );

        List<Assignment> assignments = new ArrayList<>();
        for (As a : defs) {
            assignments.add(assignmentRepository.save(Assignment.builder()
                    .course(courses.get(a.course()))
                    .title(a.title())
                    .description(a.desc())
                    .dueDate(LocalDate.now().plusDays(a.daysFromNow()).atTime(23, 59))
                    .points(a.points())
                    .priority(a.priority())
                    .createdAt(LocalDateTime.now().minusWeeks(2))
                    .build()));
        }
        return assignments;
    }

    /**
     * Past-due work is graded, near-future work is partially started — weighted by
     * each student's completion profile.
     */
    private void seedSubmissions(List<Seeded> students, List<Assignment> assignments) {
        for (Seeded s : students) {
            Set<Long> enrolledCourseIds = new HashSet<>();
            enrollmentRepository.findByStudent(s.user()).forEach(e -> enrolledCourseIds.add(e.getCourse().getId()));

            for (Assignment a : assignments) {
                if (!enrolledCourseIds.contains(a.getCourse().getId())) continue;

                boolean overdue = a.getDueDate().isBefore(LocalDateTime.now());
                boolean acted = RNG.nextDouble() < s.profile().completionRate;

                Submission.Status status;
                if (overdue) {
                    status = acted ? Submission.Status.GRADED : Submission.Status.PENDING;
                } else if (acted) {
                    // Diligent students hand work in early; weaker ones are still drafting.
                    status = switch (s.profile()) {
                        case EXCELLENT, STRONG -> Submission.Status.SUBMITTED;
                        case AVERAGE -> RNG.nextBoolean() ? Submission.Status.SUBMITTED : Submission.Status.IN_PROGRESS;
                        case AT_RISK -> Submission.Status.IN_PROGRESS;
                    };
                } else {
                    status = Submission.Status.PENDING;
                }
                if (status == Submission.Status.PENDING) continue;

                Integer grade = null;
                String feedback = null;
                LocalDateTime gradedAt = null;
                if (status == Submission.Status.GRADED) {
                    int percent = jitter(s.profile().attentionBase, 8);
                    grade = (int) Math.round(a.getPoints() * percent / 100.0);
                    feedback = percent >= 85 ? "Strong submission — clear reasoning and complete coverage."
                            : percent >= 70 ? "Solid work; tighten the analysis section next time."
                            : "Partially complete — revisit the core concepts and resubmit for feedback.";
                    gradedAt = a.getDueDate().plusDays(2);
                }

                submissionRepository.save(Submission.builder()
                        .assignment(a)
                        .student(s.user())
                        .status(status)
                        .grade(grade)
                        .feedback(feedback)
                        .fileName(status == Submission.Status.IN_PROGRESS ? null : "submission.pdf")
                        .startedAt(a.getDueDate().minusDays(4))
                        .submittedAt(status == Submission.Status.IN_PROGRESS ? null : a.getDueDate().minusHours(3))
                        .gradedAt(gradedAt)
                        .build());
            }
        }
    }

    private Exam seedExam(Course course) {
        Exam exam = examRepository.save(Exam.builder()
                .title("Machine Learning Midterm Examination")
                .description("Proctored examination with browser lockdown, camera tracking and tab-switch monitoring.")
                .course(course)
                .durationMinutes(60)
                .lockdownEnabled(true)
                .cameraRequired(true)
                .maxTabSwitches(3)
                .startTime(LocalDateTime.now().minusDays(5).withHour(10).withMinute(0))
                .endTime(LocalDateTime.now().plusDays(9))
                .build());

        questionRepository.saveAll(List.of(
                Question.builder().exam(exam)
                        .questionText("Which browser library performs the client-side landmark detection in this platform?")
                        .type(Question.QuestionType.MCQ)
                        .optionA("TensorFlow.js / face-api.js").optionB("OpenCV Python")
                        .optionC("jQuery Vision").optionD("Three.js")
                        .correctAnswer("A").marks(5).build(),
                Question.builder().exam(exam)
                        .questionText("Which protocol carries peer-to-peer audio and video in the virtual classroom?")
                        .type(Question.QuestionType.MCQ)
                        .optionA("HTTP REST").optionB("WebRTC").optionC("MQTT").optionD("gRPC")
                        .correctAnswer("B").marks(5).build(),
                Question.builder().exam(exam)
                        .questionText("What is the purpose of the smoothing factor in an exponential moving average?")
                        .type(Question.QuestionType.MCQ)
                        .optionA("It removes outliers entirely").optionB("It weights recent readings more heavily")
                        .optionC("It normalises the range to 0-1").optionD("It converts the series to a median")
                        .correctAnswer("B").marks(5).build(),
                Question.builder().exam(exam)
                        .questionText("Explain the role of the HTML5 Page Visibility API in exam proctoring lockdown.")
                        .type(Question.QuestionType.SHORT_ANSWER).marks(10).build()
        ));
        return exam;
    }

    /**
     * A short quiz that nobody has attempted, so the proctored exam flow can
     * actually be sat live. The midterm above keeps its history for analytics.
     */
    private void seedOpenQuiz(Course course) {
        Exam quiz = examRepository.save(Exam.builder()
                .title("Data Structures Class Test")
                .description("Short proctored class test. Browser lockdown is enabled: leaving this tab is "
                        + "recorded, and three switches will submit your paper automatically.")
                .course(course)
                .durationMinutes(15)
                .lockdownEnabled(true)
                .cameraRequired(true)
                .maxTabSwitches(3)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now().plusDays(14))
                .build());

        questionRepository.saveAll(List.of(
                Question.builder().exam(quiz)
                        .questionText("What is the average time complexity of a search in a balanced binary search tree?")
                        .type(Question.QuestionType.MCQ)
                        .optionA("O(1)").optionB("O(log n)").optionC("O(n)").optionD("O(n log n)")
                        .correctAnswer("B").marks(5).build(),
                Question.builder().exam(quiz)
                        .questionText("Which data structure underpins a breadth-first traversal of a graph?")
                        .type(Question.QuestionType.MCQ)
                        .optionA("Stack").optionB("Queue").optionC("Heap").optionD("Trie")
                        .correctAnswer("B").marks(5).build(),
                Question.builder().exam(quiz)
                        .questionText("A hash table degrades to which complexity when every key collides?")
                        .type(Question.QuestionType.MCQ)
                        .optionA("O(log n)").optionB("O(1)").optionC("O(n)").optionD("O(n²)")
                        .correctAnswer("C").marks(5).build(),
                Question.builder().exam(quiz)
                        .questionText("Explain when you would choose a linked list over a dynamic array, and why.")
                        .type(Question.QuestionType.SHORT_ANSWER).marks(10).build()
        ));
    }

    private void seedExamAttempts(List<Seeded> students, Exam exam) {
        int maxScore = 25;
        for (Seeded s : students) {
            boolean enrolled = enrollmentRepository.findByStudentAndCourse(s.user(), exam.getCourse()).isPresent();
            if (!enrolled) continue;

            int percent = jitter(s.profile().attentionBase, 10);
            int tabSwitches = s.profile() == Profile.AT_RISK ? RNG.nextInt(3) : 0;
            double attentionDuringExam = jitter(s.profile().attentionBase, 6);

            attemptRepository.save(ExamAttempt.builder()
                    .exam(exam)
                    .student(s.user())
                    .startTime(exam.getStartTime())
                    .endTime(exam.getStartTime().plusMinutes(52))
                    .score((int) Math.round(maxScore * percent / 100.0))
                    .maxScore(maxScore)
                    .tabSwitchCount(tabSwitches)
                    .averageAttentionScore(attentionDuringExam)
                    .status(tabSwitches >= 3 ? ExamAttempt.AttemptStatus.AUTO_SUBMITTED_VIOLATION
                            : ExamAttempt.AttemptStatus.SUBMITTED)
                    .build());
        }
    }

    // ─────────────────────────────── classroom ────────────────────────────────

    private List<ClassroomSession> seedSessions(List<Course> courses, List<User> teachers) {
        List<ClassroomSession> sessions = new ArrayList<>();

        sessions.add(sessionRepository.save(ClassroomSession.builder()
                .title("Neural Networks — Gradient Descent")
                .course(courses.get(1)).hostTeacher(teachers.get(1))
                .isActive(false)
                .startTime(LocalDateTime.now().minusDays(5).withHour(10).withMinute(0))
                .endTime(LocalDateTime.now().minusDays(5).withHour(10).withMinute(48))
                .build()));

        sessions.add(sessionRepository.save(ClassroomSession.builder()
                .title("Neural Networks — Activation Functions")
                .course(courses.get(1)).hostTeacher(teachers.get(1))
                .isActive(false)
                .startTime(LocalDateTime.now().minusDays(2).withHour(11).withMinute(0))
                .endTime(LocalDateTime.now().minusDays(2).withHour(11).withMinute(45))
                .build()));

        sessions.add(sessionRepository.save(ClassroomSession.builder()
                .title("Neural Networks — Backpropagation")
                .course(courses.get(1)).hostTeacher(teachers.get(1))
                .isActive(true)
                .startTime(LocalDateTime.now().minusMinutes(45))
                .build()));

        return sessions;
    }

    /**
     * Chat is spread across the past week rather than dumped into one minute, so
     * the participation series in the weekly chart varies day to day.
     */
    private void seedChat(ClassroomSession session, List<Seeded> students, User teacher) {
        chatMessageRepository.save(ChatMessage.builder()
                .session(session).sender(teacher)
                .content("Welcome everyone. Please download today's dataset before we begin.")
                .timestamp(session.getStartTime().plusMinutes(2))
                .build());

        for (Seeded s : students) {
            for (int i = 0; i < s.profile().chatMessages; i++) {
                int daysAgo = RNG.nextInt(7);
                LocalDateTime at = LocalDate.now().minusDays(daysAgo)
                        .atTime(10, 5).plusMinutes(RNG.nextInt(40));
                if (at.isAfter(LocalDateTime.now())) at = LocalDateTime.now().minusMinutes(5);

                chatMessageRepository.save(ChatMessage.builder()
                        .session(session).sender(s.user())
                        .content(CHAT_LINES.get(RNG.nextInt(CHAT_LINES.size())))
                        .timestamp(at)
                        .build());
            }
        }
    }

    private static final List<String> CHAT_LINES = List.of(
            "Downloaded, thanks!",
            "Could you repeat the chain rule step?",
            "Is the bias term updated the same way?",
            "That example really helped, thank you.",
            "Will this be covered in the midterm?",
            "Sharing my notes with the group after class.",
            "Getting a dimension mismatch on layer two — any hints?",
            "Makes sense now."
    );

    /**
     * Seven days of proctoring telemetry. Readings are generated around each
     * student's profile so the derived engagement, states and alerts all line up.
     */
    private void seedAttentionAndAlerts(List<Seeded> students, List<ClassroomSession> sessions) {
        ClassroomSession live = sessions.get(sessions.size() - 1);

        for (int dayOffset = 6; dayOffset >= 0; dayOffset--) {
            LocalDate day = LocalDate.now().minusDays(dayOffset);
            if (day.getDayOfWeek() == DayOfWeek.SUNDAY) continue;

            for (Seeded s : students) {
                int readings = dayOffset == 0 ? 8 : 5;
                for (int i = 0; i < readings; i++) {
                    LocalDateTime at = day.atTime(LocalTime.of(10, 0)).plusMinutes(i * 6L);
                    if (at.isAfter(LocalDateTime.now())) break;

                    int score = Math.max(5, Math.min(100, jitter(s.profile().attentionBase, 14)));

                    // Disengaged students periodically leave the camera frame entirely.
                    boolean steppedAway = s.profile() == Profile.AT_RISK && RNG.nextDouble() < 0.14;
                    if (steppedAway) score = RNG.nextInt(12);

                    boolean faceDetected = score > 15;
                    boolean tabActive = !(s.profile() == Profile.AT_RISK && RNG.nextDouble() < 0.18);

                    String eyeStatus;
                    if (!faceDetected) eyeStatus = "NO_FACE";
                    else if (score < 45) eyeStatus = "LOOKING_AWAY";
                    else if (score < 60) eyeStatus = "LOOKING_DOWN";
                    else eyeStatus = "CENTER";

                    attentionLogRepository.save(AttentionLog.builder()
                            .student(s.user())
                            .sessionId(live.getId())
                            .contextType("CLASSROOM")
                            .score((double) score)
                            .faceDetected(faceDetected)
                            .faceCount(faceDetected ? 1 : 0)
                            .eyeStatus(eyeStatus)
                            .isTabActive(tabActive)
                            .timestamp(at)
                            .build());

                    // Mirror the alert rules the live monitoring service applies.
                    if (!faceDetected) {
                        saveAlert(s.user(), live, Alert.AlertType.NO_FACE, Alert.Severity.HIGH,
                                s.user().getFullName() + " left camera view / no face detected.", at);
                    } else if (!tabActive) {
                        saveAlert(s.user(), live, Alert.AlertType.TAB_SWITCH, Alert.Severity.HIGH,
                                s.user().getFullName() + " switched tab or window during the session.", at);
                    } else if ("LOOKING_AWAY".equals(eyeStatus)) {
                        saveAlert(s.user(), live, Alert.AlertType.LOOKING_AWAY, Alert.Severity.LOW,
                                s.user().getFullName() + " is looking away from the session.", at);
                    }
                }
            }
        }
    }

    private void saveAlert(User student, ClassroomSession session, Alert.AlertType type,
                           Alert.Severity severity, String message, LocalDateTime at) {
        alertRepository.save(Alert.builder()
                .student(student)
                .sessionId(session.getId())
                .contextType("CLASSROOM")
                .alertType(type)
                .severity(severity)
                .message(message)
                .timestamp(at)
                .build());
    }

    // ──────────────────────────────── campus ──────────────────────────────────

    private void seedEvents() {
        record Ev(String title, int daysFromNow, int hour, String type, int credits, String location) {
        }
        List<Ev> defs = List.of(
                new Ev("AI Workshop: LLMs in Education", 8, 10, "workshop", 2, "Auditorium A"),
                new Ev("Hackathon: Code for Change", 10, 9, "competition", 3, "Innovation Lab"),
                new Ev("Research Paper Presentation", 13, 14, "seminar", 1, "Conference Hall"),
                new Ev("Career Fair 2026", 16, 10, "career", 1, "Main Campus"),
                new Ev("Tech Talk: Cloud Native Systems", 20, 15, "seminar", 1, "Seminar Hall B")
        );
        for (Ev e : defs) {
            eventRepository.save(CampusEvent.builder()
                    .title(e.title())
                    .startsAt(LocalDate.now().plusDays(e.daysFromNow()).atTime(e.hour(), 0))
                    .type(e.type())
                    .credits(e.credits())
                    .location(e.location())
                    .build());
        }
    }

    private void seedCredits(List<Seeded> students) {
        record Cr(String title, CreditActivity.Category category, int credits, int daysAgo) {
        }
        List<Cr> catalogue = List.of(
                new Cr("AI Workshop Champion", CreditActivity.Category.WORKSHOP, 3, 28),
                new Cr("Hackathon Finalist", CreditActivity.Category.COMPETITION, 4, 53),
                new Cr("AWS Cloud Practitioner", CreditActivity.Category.CERTIFICATION, 5, 94),
                new Cr("Research Paper Published", CreditActivity.Category.RESEARCH, 5, 112),
                new Cr("Community Service Lead", CreditActivity.Category.VOLUNTEERING, 2, 150),
                new Cr("TensorFlow Developer Certificate", CreditActivity.Category.CERTIFICATION, 5, 165),
                new Cr("Robotics Club Coordinator", CreditActivity.Category.CLUB, 3, 190),
                new Cr("Consistent On-Time Submissions", CreditActivity.Category.TIMELY_SUBMISSION, 6, 20),
                new Cr("Design Sprint Workshop", CreditActivity.Category.WORKSHOP, 5, 60),
                new Cr("Inter-College Coding Contest", CreditActivity.Category.COMPETITION, 2, 75)
        );

        for (Seeded s : students) {
            // Stronger students have accumulated more co-curricular credit.
            int awards = switch (s.profile()) {
                case EXCELLENT -> 9;
                case STRONG -> 7;
                case AVERAGE -> 4;
                case AT_RISK -> 2;
            };
            for (int i = 0; i < awards; i++) {
                Cr c = catalogue.get(i % catalogue.size());
                creditRepository.save(CreditActivity.builder()
                        .student(s.user())
                        .title(c.title())
                        .category(c.category())
                        .credits(c.credits())
                        .awardedOn(LocalDate.now().minusDays(c.daysAgo()))
                        .build());
            }
        }
    }

    private void seedNotifications(List<Seeded> students, List<User> teachers) {
        for (Seeded s : students) {
            notificationRepository.save(Notification.builder()
                    .recipient(s.user())
                    .title("Assignment due soon")
                    .message("Binary Search Tree Implementation is due within the week.")
                    .type("warning").readFlag(false)
                    .createdAt(LocalDateTime.now().minusHours(2))
                    .build());

            notificationRepository.save(Notification.builder()
                    .recipient(s.user())
                    .title("New grade posted")
                    .message("Your ER Diagram Design submission has been graded.")
                    .type("success").readFlag(false)
                    .createdAt(LocalDateTime.now().minusHours(5))
                    .build());

            notificationRepository.save(Notification.builder()
                    .recipient(s.user())
                    .title("Class rescheduled")
                    .message("Machine Learning moves to 15:00 tomorrow.")
                    .type("info").readFlag(true)
                    .createdAt(LocalDateTime.now().minusDays(1))
                    .build());

            if (s.profile() == Profile.AT_RISK) {
                notificationRepository.save(Notification.builder()
                        .recipient(s.user())
                        .title("Low attendance alert")
                        .message("Your attendance has fallen below the 75% requirement.")
                        .type("danger").readFlag(false)
                        .createdAt(LocalDateTime.now().minusDays(3))
                        .build());
            }
        }

        for (User teacher : teachers) {
            notificationRepository.save(Notification.builder()
                    .recipient(teacher)
                    .title("Submissions awaiting review")
                    .message("Several submissions in your courses are ready to grade.")
                    .type("info").readFlag(false)
                    .createdAt(LocalDateTime.now().minusHours(3))
                    .build());

            notificationRepository.save(Notification.builder()
                    .recipient(teacher)
                    .title("AI engagement alert")
                    .message("Two students in your cohort dropped below the engagement threshold.")
                    .type("danger").readFlag(false)
                    .createdAt(LocalDateTime.now().minusMinutes(40))
                    .build());
        }
    }

    // ──────────────────────────────── helpers ─────────────────────────────────

    /** A value around {@code base}, varied by up to ±{@code spread}. */
    private int jitter(int base, int spread) {
        return base + RNG.nextInt(spread * 2 + 1) - spread;
    }

    private String avatar(String seed) {
        return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + seed.replace(" ", "");
    }
}