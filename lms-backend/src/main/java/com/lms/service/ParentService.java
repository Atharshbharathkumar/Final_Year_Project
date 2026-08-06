package com.lms.service;

import com.lms.dto.UserDto;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Read-only guardian view.
 *
 * A parent sees a summary per child: attendance, achievements, assignment
 * marks. Deliberately excluded: live camera feeds, per-frame attention samples,
 * and proctoring snapshots. Aggregates answer "how is my child doing"; the raw
 * surveillance stream does not, and handing it to a third party is a different
 * thing from reporting progress.
 */
@Service
@RequiredArgsConstructor
public class ParentService {

    private final ParentLinkRepository parentLinkRepository;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final AttendanceService attendanceService;
    private final AchievementService achievementService;
    private final AccessGuard accessGuard;

    public List<UserDto> getChildren(User parent) {
        return parentLinkRepository.findByParent(parent).stream()
                .map(ParentLink::getStudent)
                .map(s -> UserDto.builder()
                        .id(s.getId())
                        .fullName(s.getFullName())
                        .email(s.getEmail())
                        .role(s.getRole())
                        .avatarUrl(s.getAvatarUrl())
                        .build())
                .collect(Collectors.toList());
    }

    public ChildReport getChildReport(User parent, Long studentId) {
        User student = accessGuard.requireStudent(studentId);
        // Enforced here rather than assumed: holding the PARENT role is not
        // permission to read an arbitrary student.
        accessGuard.requireCanView(parent, student);

        List<Submission> graded = submissionRepository.findByStudentOrderBySubmittedAtDesc(student)
                .stream()
                .filter(s -> s.getMarksAwarded() != null)
                .collect(Collectors.toList());

        Double averageMarkPercent = graded.isEmpty() ? null :
                Math.round(graded.stream()
                        .mapToDouble(s -> {
                            Integer max = s.getAssignment().getMaxMarks();
                            return max == null || max == 0 ? 0 : (s.getMarksAwarded() * 100.0 / max);
                        })
                        .average().orElse(0) * 10.0) / 10.0;

        return ChildReport.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .attendance(attendanceService.summarise(student, parent))
                .achievements(achievementService.summarise(student, parent))
                .gradedAssignments(graded.size())
                .averageMarkPercent(averageMarkPercent)
                .build();
    }

    @Transactional
    public ParentLink link(Long parentId, Long studentId, String relationship, User actor) {
        accessGuard.requireStaff(actor);

        User parent = userRepository.findById(parentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent not found"));
        if (parent.getRole() != User.Role.PARENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That user is not a parent");
        }
        User student = accessGuard.requireStudent(studentId);

        if (parentLinkRepository.existsByParentAndStudent(parent, student)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That link already exists");
        }

        return parentLinkRepository.save(ParentLink.builder()
                .parent(parent).student(student).relationship(relationship).build());
    }

    @Data
    @Builder
    public static class ChildReport {
        private Long studentId;
        private String studentName;
        private AttendanceService.AttendanceSummary attendance;
        private AchievementService.AchievementSummary achievements;
        private int gradedAssignments;
        private Double averageMarkPercent;
    }
}
