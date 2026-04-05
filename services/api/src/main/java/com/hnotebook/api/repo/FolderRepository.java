package com.hnotebook.api.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hnotebook.api.domain.Folder;
import com.hnotebook.api.domain.User;

public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findByUserOrderByNameAsc(User user);

    long countByParent_Id(UUID parentId);

    Optional<Folder> findByIdAndUser_Id(UUID id, UUID userId);
}
