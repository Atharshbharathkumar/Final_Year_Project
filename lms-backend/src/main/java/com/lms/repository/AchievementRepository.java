package com.lms.repository;

import com.lms.model.Achievement;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AchievementRepository extends JpaRepository<Achievement, Long> {
    List<Achievement> findByStudentOrderByAwardedOnDesc(User student);
    List<Achievement> findAllByOrderByAwardedOnDesc();
    List<Achievement> findByCategoryOrderByAwardedOnDesc(Achievement.Category category);

    @Query("SELECT COALESCE(SUM(a.points), 0) FROM Achievement a WHERE a.student = :student")
    int totalPointsFor(@Param("student") User student);
}
