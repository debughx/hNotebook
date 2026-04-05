package com.hnotebook.api.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hnotebook.api.domain.Note;
import com.hnotebook.api.domain.User;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    Optional<Note> findByIdAndUser_Id(UUID id, UUID userId);

    @Query("""
            SELECT DISTINCT n FROM Note n
            LEFT JOIN FETCH n.tags
            WHERE n.user = :user
            AND (:folderId IS NULL OR (n.folder IS NOT NULL AND n.folder.id = :folderId))
            AND (:tagId IS NULL OR EXISTS (
                SELECT 1 FROM Tag t WHERE t.id = :tagId AND t MEMBER OF n.tags
            ))
            ORDER BY n.updatedAt DESC
            """)
    List<Note> findForList(
            @Param("user") User user,
            @Param("folderId") UUID folderId,
            @Param("tagId") UUID tagId);
}
