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
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
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
     * Cooldown between two alerts of the same type for the same student in the
     * same session. Without this, a student looking away for 30s produced one
     * Alert row and one broadcast per sample tick.
     */
    private static final Duration ALERT_COOLDOWN = Duration.ofSeconds(60);
    private final Map<String, LocalDateTime> lastAlertAt = new ConcurrentHashMap<>();

    /**
     * @param studentEmail the authenticated principal. The student is resolved
     *                     from the session, never from the request body, so a
     *                     caller cannot log telemetry against another student.
     */
    @Transactional
    public AttentionLog recordAttention(AttentionPayloadDto dto, String studentEmail) {
        User student = userRepository.findByEmail(studentEmail)
                .orElse(null);

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

        // Null vision fields mean "not measured" (degraded engine, or a tab-switch
        // event carrying no frame). Only an explicit FALSE is evidence of absence.
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

        if (alertType != null && !isWithinCooldown(student, dto, alertType)) {
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

            // Broadcast alert over STOMP WebSocket topic
            messagingTemplate.convertAndSend("/topic/alerts/" + dto.getContextType() + "/" + dto.getSessionId(), alertDto);
        }
    }

    /**
     * True when an alert of this type was already raised for this student in this
     * session inside the cooldown window. A sustained condition should produce one
     * alert, not one per sample.
     */
    private boolean isWithinCooldown(User student, AttentionPayloadDto dto, Alert.AlertType type) {
        String key = student.getId() + "|" + dto.getContextType() + "|" + dto.getSessionId() + "|" + type;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime previous = lastAlertAt.get(key);

        if (previous != null && previous.isAfter(now.minus(ALERT_COOLDOWN))) {
            return true;
        }
        lastAlertAt.put(key, now);
        return false;
    }

    /**
     * Server-computed mean attention for a student in a session. Used instead of a
     * client-supplied figure so the exam integrity record cannot be set by the
     * browser being audited.
     */
    public Double averageAttentionFor(User student, Long sessionId, String contextType) {
        return attentionLogRepository.averageScoreFor(student, sessionId, contextType);
    }

    public long measuredSampleCount(User student, Long sessionId, String contextType) {
        return attentionLogRepository.countByStudentAndSessionIdAndContextTypeAndScoreIsNotNull(
                student, sessionId, contextType);
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
