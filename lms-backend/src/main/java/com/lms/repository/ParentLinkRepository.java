package com.lms.repository;

import com.lms.model.ParentLink;
import com.lms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ParentLinkRepository extends JpaRepository<ParentLink, Long> {
    List<ParentLink> findByParent(User parent);
    List<ParentLink> findByStudent(User student);
    boolean existsByParentAndStudent(User parent, User student);
}
