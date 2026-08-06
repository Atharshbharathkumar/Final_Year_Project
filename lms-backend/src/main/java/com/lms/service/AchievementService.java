package com.lms.service;

import com.lms.model.Achievement;
import com.lms.model.User;
import com.lms.repository.AchievementRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AchievementService {

    private final AchievementRepository achievementRepository;
    private final AccessGuard accessGuard;

    public List<Achievement> getForStudent(User student, User viewer) {
        accessGuard.requireCanView(viewer, student);
        return achievementRepository.findByStudentOrderByAwardedOnDesc(student);
    }

    /** Whole-institution feed, for the recognition wall. Staff only. */
    public List<Achievement> getAll(User viewer) {
        accessGuard.requireStaff(viewer);
        return achievementRepository.findAllByOrderByAwardedOnDesc();
    }

    @Transactional
    public Achievement award(Long studentId, Achievement achievement, User awarder) {
        // Only staff may award. Without this a student could record their own
        // accomplishments, which would make the whole record worthless.
        accessGuard.requireStaff(awarder);
        User student = accessGuard.requireStudent(studentId);

        if (achievement.getTitle() == null || achievement.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required");
        }
        if (achievement.getCategory() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category is required");
        }
        if (achievement.getPoints() != null && (achievement.getPoints() < 0 || achievement.getPoints() > 100)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Points must be between 0 and 100");
        }

        achievement.setId(null);
        achievement.setStudent(student);
        achievement.setAwardedBy(awarder);
        return achievementRepository.save(achievement);
    }

    @Transactional
    public void delete(Long achievementId, User actor) {
        accessGuard.requireStaff(actor);
        if (!achievementRepository.existsById(achievementId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Achievement not found");
        }
        achievementRepository.deleteById(achievementId);
    }

    public AchievementSummary summarise(User student, User viewer) {
        accessGuard.requireCanView(viewer, student);
        List<Achievement> all = achievementRepository.findByStudentOrderByAwardedOnDesc(student);

        Map<Achievement.Category, Integer> byCategory = new EnumMap<>(Achievement.Category.class);
        for (Achievement.Category c : Achievement.Category.values()) byCategory.put(c, 0);
        all.forEach(a -> byCategory.merge(a.getCategory(), 1, Integer::sum));

        return AchievementSummary.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .total(all.size())
                .totalPoints(achievementRepository.totalPointsFor(student))
                .countByCategory(byCategory)
                .build();
    }

    @Data
    @Builder
    public static class AchievementSummary {
        private Long studentId;
        private String studentName;
        private int total;
        private int totalPoints;
        private Map<Achievement.Category, Integer> countByCategory;
    }
}
