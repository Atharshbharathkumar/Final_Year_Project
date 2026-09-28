package com.lms.security;

import com.lms.model.User;
import com.lms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Resolves the authenticated principal to a managed {@link User}.
 */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    private final UserRepository userRepository;

    public User require(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new IllegalStateException("No authenticated user on this request");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new IllegalStateException("Authenticated user no longer exists"));
    }

    /**
     * The student whose data a request should show: the caller themselves, or for
     * a guardian account the student they are linked to. Teachers and admins must
     * pass an explicit student id instead.
     */
    public User subjectStudent(Authentication authentication) {
        User caller = require(authentication);
        if (caller.getRole() == User.Role.PARENT) {
            if (caller.getLinkedStudent() == null) {
                throw new IllegalArgumentException("This guardian account is not linked to a student");
            }
            return caller.getLinkedStudent();
        }
        return caller;
    }

    /**
     * Resolves an explicitly requested student, falling back to the caller's own
     * subject when no id is supplied.
     */
    public User subjectStudent(Authentication authentication, Long requestedId) {
        if (requestedId == null) return subjectStudent(authentication);

        User caller = require(authentication);
        if (caller.getRole() == User.Role.STUDENT && !caller.getId().equals(requestedId)) {
            throw new IllegalArgumentException("Students may only view their own record");
        }
        if (caller.getRole() == User.Role.PARENT) {
            User child = caller.getLinkedStudent();
            if (child == null || !child.getId().equals(requestedId)) {
                throw new IllegalArgumentException("Guardians may only view their linked student");
            }
            return child;
        }
        return userRepository.findById(requestedId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + requestedId));
    }
}