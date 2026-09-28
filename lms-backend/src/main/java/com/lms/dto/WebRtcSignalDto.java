package com.lms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebRtcSignalDto {
    private String type; // "offer", "answer", "candidate", "hand_raise", "reaction", "spot_check"
    private Long senderId;
    private String senderName;
    private Long targetId;
    private Long sessionId;
    private Object signalData;
}
