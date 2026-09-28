package com.lms.service;

import com.lms.dto.AcademicDtos;
import com.lms.model.Notification;
import com.lms.model.User;
import com.lms.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public List<AcademicDtos.NotificationCard> forUser(User user) {
        return notificationRepository.findByRecipientOrderByCreatedAtDesc(user).stream()
                .map(this::toCard)
                .toList();
    }

    public long unreadCount(User user) {
        return notificationRepository.countByRecipientAndReadFlagFalse(user);
    }

    @Transactional
    public void markRead(Long id, User user) {
        notificationRepository.findById(id)
                .filter(n -> n.getRecipient().getId().equals(user.getId()))
                .ifPresent(n -> {
                    n.setReadFlag(true);
                    notificationRepository.save(n);
                });
    }

    @Transactional
    public void markAllRead(User user) {
        List<Notification> all = notificationRepository.findByRecipientOrderByCreatedAtDesc(user);
        all.forEach(n -> n.setReadFlag(true));
        notificationRepository.saveAll(all);
    }

    /**
     * Persists a notification and pushes it to that user's private STOMP queue so
     * an open browser sees it without polling.
     */
    @Transactional
    public Notification push(User recipient, String title, String message, String type) {
        Notification saved = notificationRepository.save(Notification.builder()
                .recipient(recipient)
                .title(title)
                .message(message)
                .type(type)
                .readFlag(false)
                .build());

        messagingTemplate.convertAndSend("/topic/notifications/" + recipient.getId(), toCard(saved));
        return saved;
    }

    private AcademicDtos.NotificationCard toCard(Notification n) {
        return AcademicDtos.NotificationCard.builder()
                .id(n.getId())
                .title(n.getTitle())
                .message(n.getMessage())
                .time(AcademicService.relativeTime(n.getCreatedAt()))
                .type(n.getType())
                .read(Boolean.TRUE.equals(n.getReadFlag()))
                .build();
    }
}