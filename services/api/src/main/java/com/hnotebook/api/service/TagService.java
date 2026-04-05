package com.hnotebook.api.service;

import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.hnotebook.api.domain.Tag;
import com.hnotebook.api.domain.User;
import com.hnotebook.api.repo.TagRepository;
import com.hnotebook.api.repo.UserRepository;
import com.hnotebook.api.security.UserPrincipal;
import com.hnotebook.api.web.dto.TagDtos.TagCreateRequest;
import com.hnotebook.api.web.dto.TagDtos.TagPatchRequest;
import com.hnotebook.api.web.dto.TagDtos.TagResponse;

@Service
public class TagService {

    private final TagRepository tagRepository;
    private final UserRepository userRepository;

    public TagService(TagRepository tagRepository, UserRepository userRepository) {
        this.tagRepository = tagRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<TagResponse> list(UserPrincipal principal) {
        User user = loadUser(principal);
        return tagRepository.findByUserOrderByNameAsc(user).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TagResponse create(UserPrincipal principal, TagCreateRequest request) {
        User user = loadUser(principal);
        String name = request.name().trim();
        if (tagRepository.existsByUserAndNameIgnoreCase(user, name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tag name already exists");
        }
        Tag tag = new Tag(user, name);
        try {
            tagRepository.save(tag);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tag name already exists");
        }
        return toResponse(tag);
    }

    @Transactional
    public TagResponse patch(UserPrincipal principal, UUID id, TagPatchRequest request) {
        Tag tag = tagRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag not found"));
        String name = request.name().trim();
        if (!name.equalsIgnoreCase(tag.getName())
                && tagRepository.existsByUserAndNameIgnoreCase(tag.getUser(), name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tag name already exists");
        }
        tag.setName(name);
        try {
            tagRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tag name already exists");
        }
        return toResponse(tag);
    }

    @Transactional
    public void delete(UserPrincipal principal, UUID id) {
        Tag tag = tagRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag not found"));
        tagRepository.delete(tag);
    }

    private User loadUser(UserPrincipal principal) {
        return userRepository.findById(principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private TagResponse toResponse(Tag tag) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getCreatedAt());
    }
}
