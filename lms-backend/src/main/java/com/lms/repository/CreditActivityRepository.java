package com.lms.repository;

import com.lms.model.CreditActivity;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CreditActivityRepository extends JpaRepository<CreditActivity, Long> {
    List<CreditActivity> findByStudentOrderByAwardedOnDesc(User student);
}