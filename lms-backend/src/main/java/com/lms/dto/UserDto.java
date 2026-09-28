package com.lms.dto;

import com.lms.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private Long id;
    private String email;
    private String fullName;
    private User.Role role;
    private String avatarUrl;
    private String avatarEmoji;
    private String department;
    private Integer studyYear;
    /** Populated for guardian accounts so the UI knows whose data it is showing. */
    private Long linkedStudentId;
    private String linkedStudentName;
}