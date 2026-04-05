package com.hnotebook.api.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @Email @NotBlank @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 72) String password
    ) {
    }

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {
    }

    public record TokenResponse(String accessToken, String tokenType) {
        public static TokenResponse bearer(String accessToken) {
            return new TokenResponse(accessToken, "Bearer");
        }
    }
}
