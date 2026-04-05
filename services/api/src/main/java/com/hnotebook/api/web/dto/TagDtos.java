package com.hnotebook.api.web.dto;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class TagDtos {

    private TagDtos() {
    }

    public record TagCreateRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record TagPatchRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record TagResponse(UUID id, String name, Instant createdAt) {
    }
}
