package com.lms.service;

import com.lms.model.ChatMessage;
import com.lms.model.ClassroomSession;
import com.lms.model.Course;
import com.lms.model.User;
import com.lms.repository.ChatMessageRepository;
import com.lms.repository.ClassroomSessionRepository;
import com.lms.repository.CourseRepository;
import com.lms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomSessionRepository sessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;

    public List<ClassroomSession> getActiveSessions() {
        return sessionRepository.findByIsActiveTrue();
    }

    public List<ClassroomSession> getSessionsByCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        return sessionRepository.findByCourse(course);
    }

    public ClassroomSession getSessionById(Long id) {
        return sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
    }

    @Transactional
    public ClassroomSession createSession(String title, Long courseId, String teacherEmail) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        ClassroomSession session = ClassroomSession.builder()
                .title(title)
                .course(course)
                .hostTeacher(teacher)
                .isActive(true)
                .startTime(LocalDateTime.now())
                .build();
        return sessionRepository.save(session);
    }

    @Transactional
    public ClassroomSession endSession(Long sessionId) {
        ClassroomSession session = getSessionById(sessionId);
        session.setIsActive(false);
        session.setEndTime(LocalDateTime.now());
        return sessionRepository.save(session);
    }

    @Transactional
    public ChatMessage saveChatMessage(Long sessionId, String senderEmail, String content) {
        ClassroomSession session = getSessionById(sessionId);
        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        ChatMessage message = ChatMessage.builder()
                .session(session)
                .sender(sender)
                .content(content)
                .build();
        return chatMessageRepository.save(message);
    }

    public List<ChatMessage> getChatHistory(Long sessionId) {
        ClassroomSession session = getSessionById(sessionId);
        return chatMessageRepository.findBySessionOrderByTimestampAsc(session);
    }
}
