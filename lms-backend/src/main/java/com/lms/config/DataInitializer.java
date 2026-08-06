package com.lms.config;

import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final AchievementRepository achievementRepository;
    private final ParentLinkRepository parentLinkRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.count() > 0) return;

        // Seed Users
        User teacher = User.builder()
                .email("teacher@lms.com")
                .password(passwordEncoder.encode("password"))
                .fullName("Prof. Alan Turing")
                .role(User.Role.TEACHER)
                .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=AlanTuring")
                .build();
        userRepository.save(teacher);

        User student1 = User.builder()
                .email("student@lms.com")
                .password(passwordEncoder.encode("password"))
                .fullName("John Doe")
                .role(User.Role.STUDENT)
                .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=JohnDoe")
                .build();
        userRepository.save(student1);

        User student2 = User.builder()
                .email("student2@lms.com")
                .password(passwordEncoder.encode("password"))
                .fullName("Emma Watson")
                .role(User.Role.STUDENT)
                .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=EmmaWatson")
                .build();
        userRepository.save(student2);

        User admin = User.builder()
                .email("admin@lms.com")
                .password(passwordEncoder.encode("password"))
                .fullName("System Administrator")
                .role(User.Role.ADMIN)
                .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=Admin")
                .build();
        userRepository.save(admin);

        User parent = User.builder()
                .email("parent@lms.com")
                .password(passwordEncoder.encode("password"))
                .fullName("Mary Doe")
                .role(User.Role.PARENT)
                .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=MaryDoe")
                .build();
        userRepository.save(parent);

        // Mary is linked to John only. Signing in as her and requesting Emma's
        // report returns 403 — useful to demonstrate that the role alone grants
        // nothing without a link.
        parentLinkRepository.save(ParentLink.builder()
                .parent(parent).student(student1).relationship("Mother").build());

        // Seed Courses
        Course course1 = Course.builder()
                .title("CS401: Advanced AI & Computer Vision")
                .courseCode("CS401")
                .description("Deep dive into modern convolutional neural networks, face detection algorithms, and real-time WebRTC media streams.")
                .teacher(teacher)
                .coverImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80")
                .build();
        courseRepository.save(course1);

        Course course2 = Course.builder()
                .title("CS302: Modern Web Application Engineering")
                .courseCode("CS302")
                .description("Full-stack application design using React, Spring Boot, WebSockets, and stateful authentication pattern.")
                .teacher(teacher)
                .coverImage("https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80")
                .build();
        courseRepository.save(course2);

        // Seed Enrollments
        enrollmentRepository.save(Enrollment.builder().student(student1).course(course1).build());
        enrollmentRepository.save(Enrollment.builder().student(student1).course(course2).build());
        enrollmentRepository.save(Enrollment.builder().student(student2).course(course1).build());

        // Seed Exam
        Exam exam = Exam.builder()
                .title("AI & Computer Vision Midterm Examination")
                .description("Proctored examination enforcing browser lockdown, camera tracking, and tab switch monitoring. Please ensure your camera is enabled.")
                .course(course1)
                .durationMinutes(30)
                .lockdownEnabled(true)
                .cameraRequired(true)
                .maxTabSwitches(3)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now().plusDays(7))
                .build();
        examRepository.save(exam);

        // Questions
        Question q1 = Question.builder()
                .exam(exam)
                .questionText("Which browser JavaScript framework is utilized for lightweight client-side face and landmark detection in this LMS?")
                .type(Question.QuestionType.MCQ)
                .optionA("TensorFlow.js / face-api.js")
                .optionB("OpenCV Python")
                .optionC("JQuery Vision")
                .optionD("Three.js")
                .correctAnswer("A")
                .marks(5)
                .build();

        Question q2 = Question.builder()
                .exam(exam)
                .questionText("What protocol is used for peer-to-peer real-time video audio broadcasting in the virtual classroom?")
                .type(Question.QuestionType.MCQ)
                .optionA("HTTP REST")
                .optionB("WebRTC")
                .optionC("MQTT")
                .optionD("gRPC")
                .correctAnswer("B")
                .marks(5)
                .build();

        Question q3 = Question.builder()
                .exam(exam)
                .questionText("Explain the role of the HTML5 Page Visibility API in exam proctoring lockdown.")
                .type(Question.QuestionType.SHORT_ANSWER)
                .marks(10)
                .build();

        questionRepository.saveAll(List.of(q1, q2, q3));

        // Seed Classroom Session
        ClassroomSession session = ClassroomSession.builder()
                .title("Live Virtual Classroom - Real-time AI & WebRTC Architecture")
                .course(course1)
                .hostTeacher(teacher)
                .isActive(true)
                .startTime(LocalDateTime.now().minusMinutes(15))
                .build();
        sessionRepository.save(session);

        // Seed Attention Logs & Alerts
        attentionLogRepository.save(AttentionLog.builder()
                .student(student1)
                .sessionId(session.getId())
                .contextType("CLASSROOM")
                .score(95.0)
                .faceDetected(true)
                .faceCount(1)
                .eyeStatus("CENTER")
                .isTabActive(true)
                .timestamp(LocalDateTime.now().minusMinutes(10))
                .build());

        attentionLogRepository.save(AttentionLog.builder()
                .student(student2)
                .sessionId(session.getId())
                .contextType("CLASSROOM")
                .score(40.0)
                .faceDetected(true)
                .faceCount(1)
                .eyeStatus("LOOKING_AWAY")
                .isTabActive(false)
                .timestamp(LocalDateTime.now().minusMinutes(5))
                .build());

        alertRepository.save(Alert.builder()
                .student(student2)
                .sessionId(session.getId())
                .contextType("CLASSROOM")
                .alertType(Alert.AlertType.TAB_SWITCH)
                .severity(Alert.Severity.HIGH)
                .message("Student Emma Watson switched tab / window during active session.")
                .timestamp(LocalDateTime.now().minusMinutes(5))
                .build());

        seedCoursework(teacher, student1, student2, course1, course2);
    }

    /** Assignments, attendance and achievements so the new pages are not empty. */
    private void seedCoursework(User teacher, User student1, User student2,
                                Course course1, Course course2) {

        Assignment a1 = assignmentRepository.save(Assignment.builder()
                .title("Report: Head pose estimation from facial landmarks")
                .description("Explain how yaw, pitch and roll can be approximated from 68-point "
                        + "facial landmarks, and where that approximation breaks down.")
                .course(course1)
                .createdBy(teacher)
                .dueDate(LocalDateTime.now().plusDays(5))
                .maxMarks(50)
                .build());

        Assignment a2 = assignmentRepository.save(Assignment.builder()
                .title("Practical: WebRTC signalling walkthrough")
                .description("Trace an SDP offer/answer exchange between two peers and describe "
                        + "why ICE candidates may arrive before the remote description is set.")
                .course(course1)
                .createdBy(teacher)
                .dueDate(LocalDateTime.now().plusDays(12))
                .maxMarks(30)
                .build());

        assignmentRepository.save(Assignment.builder()
                .title("Design exercise: REST resource modelling")
                .description("Model the resources for a small library system and justify your "
                        + "choice of status codes.")
                .course(course2)
                .createdBy(teacher)
                .dueDate(LocalDateTime.now().plusDays(9))
                .maxMarks(40)
                .build());

        // One graded submission, one awaiting marking.
        submissionRepository.save(Submission.builder()
                .assignment(a1).student(student1)
                .content("Yaw is estimated from the horizontal offset of the nose tip relative to "
                        + "the eye midpoint, normalised by frame width. It degrades at large angles "
                        + "because the landmark detector itself loses accuracy once one eye is occluded.")
                .submittedAt(LocalDateTime.now().minusDays(1))
                .late(false)
                .marksAwarded(43)
                .feedback("Good grasp of the geometry. Say more about why this is not true PnP solving.")
                .gradedBy(teacher)
                .gradedAt(LocalDateTime.now().minusHours(6))
                .build());

        submissionRepository.save(Submission.builder()
                .assignment(a2).student(student2)
                .content("The offerer creates the SDP offer after adding local tracks, then trickles "
                        + "candidates as they are gathered. The answering peer must buffer candidates "
                        + "that arrive before setRemoteDescription completes.")
                .submittedAt(LocalDateTime.now().minusHours(3))
                .late(false)
                .build());

        // Two weeks of attendance across both students.
        LocalDate today = LocalDate.now();
        AttendanceRecord.Status[] johnPattern = {
            AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.PRESENT,
            AttendanceRecord.Status.LATE, AttendanceRecord.Status.PRESENT,
            AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.ABSENT,
        };
        AttendanceRecord.Status[] emmaPattern = {
            AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.ABSENT,
            AttendanceRecord.Status.ABSENT, AttendanceRecord.Status.PRESENT,
            AttendanceRecord.Status.LATE, AttendanceRecord.Status.PRESENT,
        };

        for (int i = 0; i < johnPattern.length; i++) {
            LocalDate date = today.minusDays(i + 1L);
            attendanceRepository.save(AttendanceRecord.builder()
                    .student(student1).course(course1).date(date)
                    .status(johnPattern[i]).source(AttendanceRecord.Source.MANUAL)
                    .markedBy(teacher).build());
            attendanceRepository.save(AttendanceRecord.builder()
                    .student(student2).course(course1).date(date)
                    .status(emmaPattern[i]).source(AttendanceRecord.Source.MANUAL)
                    .markedBy(teacher).build());
        }

        achievementRepository.saveAll(List.of(
            Achievement.builder()
                .student(student1).title("Best paper, departmental technical symposium")
                .description("Presented work on real-time attention estimation in browser-based proctoring.")
                .category(Achievement.Category.ACADEMIC).level("First place")
                .awardedOn(today.minusWeeks(3)).points(25).awardedBy(teacher).build(),
            Achievement.builder()
                .student(student1).title("Inter-college football tournament")
                .description("Member of the winning departmental side.")
                .category(Achievement.Category.SPORTS).level("Winner")
                .awardedOn(today.minusMonths(2)).points(15).awardedBy(teacher).build(),
            Achievement.builder()
                .student(student1).title("Open source contribution")
                .description("Merged accessibility fixes into a widely used charting library.")
                .category(Achievement.Category.PROJECT).level("Certificate of merit")
                .awardedOn(today.minusWeeks(6)).points(10).awardedBy(teacher).build(),
            Achievement.builder()
                .student(student2).title("Student mentoring programme")
                .description("Mentored six first-year students through their first semester.")
                .category(Achievement.Category.EXTRACURRICULAR).level("Recognised contributor")
                .awardedOn(today.minusWeeks(5)).points(12).awardedBy(teacher).build()
        ));
    }
}
