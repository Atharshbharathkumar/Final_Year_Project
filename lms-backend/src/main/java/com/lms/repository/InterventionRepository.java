package com.lms.repository;

import com.lms.model.Intervention;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterventionRepository extends JpaRepository<Intervention, Long> {
    List<Intervention> findAllByOrderByCreatedAtDesc();
    List<Intervention> findByStudentOrderByCreatedAtDesc(User student);
    long countByStatus(Intervention.Status status);
}