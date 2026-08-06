package com.lms.service;

import com.lms.model.User;
import com.lms.repository.ParentLinkRepository;
import com.lms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Answers "may this caller read this student's records?" in one place.
 *
 * Every endpoint that exposes a named student's data routes through here.
 * Keeping the rule in one method means adding the PARENT role did not scatter
 * new authorisation checks across four controllers, each free to get it wrong.
 */
@Service
@RequiredArgsConstructor
public class AccessGuard {

    private final UserRepository userRepository;
    private final ParentLinkRepository parentLinkRepository;

    public User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown user"));
    }

    public User requireStudent(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        if (student.getRole() != User.Role.STUDENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That user is not a student");
        }
        return student;
    }

    public boolean isStaff(User user) {
        return user.getRole() == User.Role.TEACHER || user.getRole() == User.Role.ADMIN;
    }

    /**
     * Staff may read anyone. A student may read themselves. A parent may read a
     * student only where a ParentLink exists — being a PARENT is not by itself
     * permission to read any student.
     */
    public boolean canView(User viewer, User student) {
        if (isStaff(viewer)) return true;
        if (viewer.getId().equals(student.getId())) return true;
        if (viewer.getRole() == User.Role.PARENT) {
            return parentLinkRepository.existsByParentAndStudent(viewer, student);
        }
        return false;
    }

    public void requireCanView(User viewer, User student) {
        if (!canView(viewer, student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You may not view this student's records");
        }
    }

    public void requireStaff(User user) {
        if (!isStaff(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Teachers and administrators only");
        }
    }
}
