package com.hnotebook.api.web.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Size;

public final class NoteDtos {

    private NoteDtos() {
    }

    public record NoteCreateRequest(
            @Size(max = 500) String title,
            String body,
            UUID folderId,
            List<UUID> tagIds
    ) {
    }

    public record NotePatchRequest(
            @Size(max = 500) String title,
            String body,
            UUID folderId,
            Boolean clearFolder
    ) {
    }

    public record NoteTagIdsRequest(List<UUID> tagIds) {
    }

    public record NoteResponse(
            UUID id,
            String title,
            String body,
            UUID folderId,
            List<TagDtos.TagResponse> tags,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
