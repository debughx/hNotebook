package com.hnotebook.api.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hnotebook.api.domain.Tag;
import com.hnotebook.api.domain.User;

public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findByUserOrderByNameAsc(User user);

    Optional<Tag> findByIdAndUser_Id(UUID id, UUID userId);

    boolean existsByUserAndNameIgnoreCase(User user, String name);

    Optional<Tag> findByUserAndNameIgnoreCase(User user, String name);
}
