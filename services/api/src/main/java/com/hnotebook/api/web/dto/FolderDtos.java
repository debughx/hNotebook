package com.hnotebook.api.web.dto;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class FolderDtos {

    private FolderDtos() {
    }

    public record FolderCreateRequest(
            @NotBlank @Size(max = 200) String name,
            UUID parentId
    ) {
    }

    public record FolderPatchRequest(
            @Size(max = 200) String name,
            UUID parentId,
            Boolean clearParent
    ) {
    }

    public record FolderResponse(UUID id, String name, UUID parentId, Instant createdAt) {
    }
}
