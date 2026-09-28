package com.lms.service;

import com.lms.dto.AlertDto;
import com.lms.dto.AttentionPayloadDto;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MonitoringService {

    private final AttentionLogRepository attentionLogRepository;
    private final AlertRepository alertRepository;
    private final ProctoringSnapshotRepository snapshotRepository;
    private final UserRepository userRepository;
    private final ExamAttemptRepository attemptRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${lms.upload.dir:uploads/snapshots/}")
    private String uploadDir;

    /**
     * Records one attention reading against the authenticated caller.
     * <p>
     * The student is taken from the security context, never from the payload:
     * a candidate must not be able to post telemetry in someone else's name,
     * either to inflate their own record or to damage a peer's.
     */
    @Transactional
    public AttentionLog recordAttention(AttentionPayloadDto dto, User student) {
        if (student == null) return null;
        dto.setStudentId(student.getId());
        dto.setStudentName(student.getFullName());

        AttentionLog log = AttentionLog.builder()
                .student(student)
                .sessionId(dto.getSessionId())
                .contextType(dto.getContextType())
                .score(dto.getScore())
                .faceDetected(dto.getFaceDetected())
                .faceCount(dto.getFaceCount())
                .eyeStatus(dto.getEyeStatus())
                .isTabActive(dto.getIsTabActive())
                .timestamp(LocalDateTime.now())
                .build();

        AttentionLog saved = attentionLogRepository.save(log);

        // Broadcast attention update via WebSocket topic for active classroom/exam monitoring
        messagingTemplate.convertAndSend("/topic/monitoring/" + dto.getContextType() + "/" + dto.getSessionId(), dto);

        // Evaluate automated alerts
        checkAndCreateAlerts(dto, student);

        return saved;
    }

    private void checkAndCreateAlerts(AttentionPayloadDto dto, User student) {
        Alert.AlertType alertType = null;
        Alert.Severity severity = Alert.Severity.MEDIUM;
        String message = null;

        if (Boolean.FALSE.equals(dto.getFaceDetected())) {
            alertType = Alert.AlertType.NO_FACE;
            severity = Alert.Severity.HIGH;
            message = "Student " + student.getFullName() + " left camera view / No face detected.";
        } else if (dto.getFaceCount() != null && dto.getFaceCount() > 1) {
            alertType = Alert.AlertType.MULTIPLE_FACES;
            severity = Alert.Severity.CRITICAL;
            message = "Multiple faces (" + dto.getFaceCount() + ") detected for " + student.getFullName() + "!";
        } else if ("LOOKING_AWAY".equals(dto.getEyeStatus()) || "EYES_CLOSED".equals(dto.getEyeStatus())) {
            alertType = Alert.AlertType.LOOKING_AWAY;
            severity = Alert.Severity.LOW;
            message = "Student " + student.getFullName() + " is looking away or inactive.";
        } else if (Boolean.FALSE.equals(dto.getIsTabActive())) {
            alertType = Alert.AlertType.TAB_SWITCH;
            severity = Alert.Severity.HIGH;
            message = "Student " + student.getFullName() + " switched tab / window!";
        }

        if (alertType != null) {
            Alert alert = Alert.builder()
                    .student(student)
                    .sessionId(dto.getSessionId())
                    .contextType(dto.getContextType())
                    .alertType(alertType)
                    .severity(severity)
                    .message(message)
                    .timestamp(LocalDateTime.now())
                    .build();

            alertRepository.save(alert);

            AlertDto alertDto = AlertDto.builder()
                    .id(alert.getId())
                    .studentId(student.getId())
                    .studentName(student.getFullName())
                    .sessionId(dto.getSessionId())
                    .contextType(dto.getContextType())
                    .alertType(alertType)
                    .severity(severity)
                    .message(message)
                    .timestamp(alert.getTimestamp())
                    .build();

            // Broadcast to the session room, and to the platform-wide feed the
            // teacher and admin dashboards subscribe to.
            messagingTemplate.convertAndSend("/topic/alerts/" + dto.getContextType() + "/" + dto.getSessionId(), alertDto);
            messagingTemplate.convertAndSend("/topic/alerts/all", alertDto);
        }
    }

    /** Raises a proctoring alert against an exam attempt. */
    @Transactional
    public Alert raiseExamAlert(User student, Long attemptId, Alert.AlertType type,
                                Alert.Severity severity, String message) {
        return raiseAlert(student, attemptId, "EXAM", type, severity, message);
    }

    /** Raises an alert against a live classroom session. */
    @Transactional
    public Alert raiseClassroomAlert(User student, Long sessionId, Alert.AlertType type,
                                     Alert.Severity severity, String message) {
        return raiseAlert(student, sessionId, "CLASSROOM", type, severity, message);
    }

    /**
     * Stores an alert and pushes it to both the room feed and the platform-wide
     * invigilator feed, so an open dashboard sees it without polling.
     */
    private Alert raiseAlert(User student, Long sessionId, String contextType,
                             Alert.AlertType type, Alert.Severity severity, String message) {
        Alert alert = alertRepository.save(Alert.builder()
                .student(student)
                .sessionId(sessionId)
                .contextType(contextType)
                .alertType(type)
                .severity(severity)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build());

        AlertDto dto = AlertDto.builder()
                .id(alert.getId())
                .studentId(student.getId())
                .studentName(student.getFullName())
                .sessionId(sessionId)
                .contextType(contextType)
                .alertType(type)
                .severity(severity)
                .message(message)
                .timestamp(alert.getTimestamp())
                .build();

        messagingTemplate.convertAndSend("/topic/alerts/" + contextType + "/" + sessionId, dto);
        messagingTemplate.convertAndSend("/topic/alerts/all", dto);
        return alert;
    }

    @Transactional
    public ProctoringSnapshot saveSnapshot(Long attemptId, String base64Image, String reason) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new RuntimeException("Attempt not found"));

        String fileName = "snapshot_" + attempt.getId() + "_" + UUID.randomUUID().toString() + ".jpg";
        String filePath = uploadDir + fileName;

        try {
            Files.createDirectories(Paths.get(uploadDir));
            String base64Data = base64Image.contains(",") ? base64Image.split(",")[1] : base64Image;
            byte[] imageBytes = Base64.getDecoder().decode(base64Data);

            try (FileOutputStream fos = new FileOutputStream(filePath)) {
                fos.write(imageBytes);
            }
        } catch (IOException e) {
            filePath = "data:image/jpeg;base64," + (base64Image.contains(",") ? base64Image.split(",")[1] : base64Image);
        }

        ProctoringSnapshot snapshot = ProctoringSnapshot.builder()
                .attempt(attempt)
                .student(attempt.getStudent())
                .imagePath(filePath)
                .triggerReason(reason)
                .flagged("MULTI_FACE".equals(reason) || "TAB_SWITCH".equals(reason))
                .timestamp(LocalDateTime.now())
                .build();

        return snapshotRepository.save(snapshot);
    }

    public List<AttentionLog> getAttentionLogs(Long sessionId, String contextType) {
        return attentionLogRepository.findBySessionIdAndContextTypeOrderByTimestampAsc(sessionId, contextType);
    }

    public List<AlertDto> getAlerts(Long sessionId, String contextType) {
        return alertRepository.findBySessionIdAndContextTypeOrderByTimestampDesc(sessionId, contextType)
                .stream()
                .map(alert -> AlertDto.builder()
                        .id(alert.getId())
                        .studentId(alert.getStudent().getId())
                        .studentName(alert.getStudent().getFullName())
                        .sessionId(alert.getSessionId())
                        .contextType(alert.getContextType())
                        .alertType(alert.getAlertType())
                        .severity(alert.getSeverity())
                        .message(alert.getMessage())
                        .snapshotPath(alert.getSnapshotPath())
                        .timestamp(alert.getTimestamp())
                        .build())
                .collect(Collectors.toList());
    }

    public List<AlertDto> getAllAlerts() {
        return alertRepository.findAllByOrderByTimestampDesc()
                .stream()
                .map(alert -> AlertDto.builder()
                        .id(alert.getId())
                        .studentId(alert.getStudent().getId())
                        .studentName(alert.getStudent().getFullName())
                        .sessionId(alert.getSessionId())
                        .contextType(alert.getContextType())
                        .alertType(alert.getAlertType())
                        .severity(alert.getSeverity())
                        .message(alert.getMessage())
                        .snapshotPath(alert.getSnapshotPath())
                        .timestamp(alert.getTimestamp())
                        .build())
                .collect(Collectors.toList());
    }
}
