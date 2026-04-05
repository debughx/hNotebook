package com.hnotebook.api.service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.hnotebook.api.domain.Folder;
import com.hnotebook.api.domain.Note;
import com.hnotebook.api.domain.Tag;
import com.hnotebook.api.domain.User;
import com.hnotebook.api.repo.FolderRepository;
import com.hnotebook.api.repo.NoteRepository;
import com.hnotebook.api.repo.TagRepository;
import com.hnotebook.api.repo.UserRepository;
import com.hnotebook.api.security.UserPrincipal;
import com.hnotebook.api.web.dto.NoteDtos.NoteCreateRequest;
import com.hnotebook.api.web.dto.NoteDtos.NotePatchRequest;
import com.hnotebook.api.web.dto.NoteDtos.NoteResponse;
import com.hnotebook.api.web.dto.TagDtos.TagResponse;

@Service
public class NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final FolderRepository folderRepository;
    private final TagRepository tagRepository;

    public NoteService(
            NoteRepository noteRepository,
            UserRepository userRepository,
            FolderRepository folderRepository,
            TagRepository tagRepository) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.folderRepository = folderRepository;
        this.tagRepository = tagRepository;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> list(UserPrincipal principal, UUID folderId, UUID tagId) {
        User user = loadUser(principal);
        return noteRepository.findForList(user, folderId, tagId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public NoteResponse get(UserPrincipal principal, UUID id) {
        Note note = noteRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
        return toResponse(note);
    }

    @Transactional
    public NoteResponse create(UserPrincipal principal, NoteCreateRequest request) {
        User user = loadUser(principal);
        Folder folder = resolveFolder(principal, request.folderId());
        Note note = new Note(
                user,
                request.title() != null ? request.title() : "",
                request.body() != null ? request.body() : "",
                folder);
        if (request.tagIds() != null && !request.tagIds().isEmpty()) {
            note.getTags().addAll(resolveTags(principal, request.tagIds()));
        }
        noteRepository.save(note);
        return toResponse(note);
    }

    @Transactional
    public NoteResponse patch(UserPrincipal principal, UUID id, NotePatchRequest request) {
        Note note = noteRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
        if (request.title() != null) {
            note.setTitle(request.title());
        }
        if (request.body() != null) {
            note.setBody(request.body());
        }
        if (Boolean.TRUE.equals(request.clearFolder())) {
            note.setFolder(null);
        } else if (request.folderId() != null) {
            note.setFolder(resolveFolder(principal, request.folderId()));
        }
        note.touchUpdated();
        return toResponse(note);
    }

    @Transactional
    public NoteResponse setTags(UserPrincipal principal, UUID id, List<UUID> tagIds) {
        Note note = noteRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
        note.getTags().clear();
        if (tagIds != null && !tagIds.isEmpty()) {
            note.getTags().addAll(resolveTags(principal, tagIds));
        }
        note.touchUpdated();
        return toResponse(note);
    }

    @Transactional
    public void delete(UserPrincipal principal, UUID id) {
        Note note = noteRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
        noteRepository.delete(note);
    }

    private User loadUser(UserPrincipal principal) {
        return userRepository.findById(principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private Folder resolveFolder(UserPrincipal principal, UUID folderId) {
        if (folderId == null) {
            return null;
        }
        return folderRepository.findByIdAndUser_Id(folderId, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
    }

    private Set<Tag> resolveTags(UserPrincipal principal, List<UUID> tagIds) {
        Set<Tag> set = new HashSet<>();
        for (UUID tagId : tagIds) {
            Tag tag = tagRepository.findByIdAndUser_Id(tagId, principal.id())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag not found: " + tagId));
            set.add(tag);
        }
        return set;
    }

    private NoteResponse toResponse(Note note) {
        UUID folderId = note.getFolder() != null ? note.getFolder().getId() : null;
        List<TagResponse> tags = note.getTags().stream()
                .map(t -> new TagResponse(t.getId(), t.getName(), t.getCreatedAt()))
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
        return new NoteResponse(
                note.getId(),
                note.getTitle(),
                note.getBody(),
                folderId,
                tags,
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
