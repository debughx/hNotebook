package com.hnotebook.api.web;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hnotebook.api.security.UserPrincipal;
import com.hnotebook.api.service.NoteService;
import com.hnotebook.api.web.dto.NoteDtos.NoteCreateRequest;
import com.hnotebook.api.web.dto.NoteDtos.NotePatchRequest;
import com.hnotebook.api.web.dto.NoteDtos.NoteResponse;
import com.hnotebook.api.web.dto.NoteDtos.NoteTagIdsRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/notes")
public class NoteController {

    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping
    public List<NoteResponse> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) UUID folderId,
            @RequestParam(required = false) UUID tagId) {
        return noteService.list(principal, folderId, tagId);
    }

    @GetMapping("/{id}")
    public NoteResponse get(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        return noteService.get(principal, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody NoteCreateRequest request) {
        return noteService.create(principal, request);
    }

    @PatchMapping("/{id}")
    public NoteResponse patch(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody NotePatchRequest request) {
        return noteService.patch(principal, id, request);
    }

    @PutMapping("/{id}/tags")
    public NoteResponse setTags(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody NoteTagIdsRequest request) {
        return noteService.setTags(principal, id, request != null ? request.tagIds() : List.of());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        noteService.delete(principal, id);
    }
}
