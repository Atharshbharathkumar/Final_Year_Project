package com.lms.repository;

import com.lms.model.ChatMessage;
import com.lms.model.ClassroomSession;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findBySessionOrderByTimestampAsc(ClassroomSession session);
    long countBySender(User sender);
}