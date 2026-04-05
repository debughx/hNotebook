package com.hnotebook.api.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.hnotebook.api.domain.User;
import com.hnotebook.api.repo.UserRepository;
import com.hnotebook.api.security.JwtService;
import com.hnotebook.api.web.dto.AuthDtos.LoginRequest;
import com.hnotebook.api.web.dto.AuthDtos.RegisterRequest;
import com.hnotebook.api.web.dto.AuthDtos.TokenResponse;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        User user = new User(
                request.email().trim().toLowerCase(),
                passwordEncoder.encode(request.password()));
        userRepository.save(user);
        return TokenResponse.bearer(jwtService.createToken(user.getId(), user.getEmail()));
    }

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email().trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return TokenResponse.bearer(jwtService.createToken(user.getId(), user.getEmail()));
    }
}
