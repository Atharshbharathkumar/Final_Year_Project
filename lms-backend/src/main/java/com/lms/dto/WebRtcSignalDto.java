package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Anything relayed through the classroom topic: chat, hand raises, polls, and
 * WebRTC session negotiation.
 *
 * Peers are addressed by {@code fromPeer}/{@code toPeer}, which are per-tab
 * random ids rather than user ids — one user may legitimately have two tabs
 * open, and each needs its own peer connection. A null {@code toPeer} means the
 * message is for everyone in the session.
 *
 * {@code signalData} is an opaque passthrough: the server never interprets SDP
 * or ICE, it only forwards it.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebRtcSignalDto {
    private String type; // CHAT, HAND_RAISE, POLL, PEER_JOIN, PEER_SIGNAL, PEER_LEAVE
    private Long senderId;
    private String senderName;
    private Long targetId;
    private Long sessionId;

    private String fromPeer;
    private String toPeer;
    private Boolean isTeacher;

    private Object signalData;
    private Object poll;
    private String content;
    private Boolean raised;
}
