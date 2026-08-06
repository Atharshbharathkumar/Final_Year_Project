package com.lms.controller;

import com.lms.dto.WebRtcSignalDto;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class SignalingController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/signal/{sessionId}")
    public void handleSignal(@DestinationVariable Long sessionId, @Payload WebRtcSignalDto signal) {
        signal.setSessionId(sessionId);
        // Broadcast signaling data (WebRTC offer, answer, ice candidates, hand raise, reactions) to all subscribers of the session
        messagingTemplate.convertAndSend("/topic/classroom/" + sessionId, signal);
    }
}
