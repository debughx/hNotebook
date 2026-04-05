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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hnotebook.api.security.UserPrincipal;
import com.hnotebook.api.service.FolderService;
import com.hnotebook.api.web.dto.FolderDtos.FolderCreateRequest;
import com.hnotebook.api.web.dto.FolderDtos.FolderPatchRequest;
import com.hnotebook.api.web.dto.FolderDtos.FolderResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/folders")
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping
    public List<FolderResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return folderService.list(principal);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FolderResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody FolderCreateRequest request) {
        return folderService.create(principal, request);
    }

    @PatchMapping("/{id}")
    public FolderResponse patch(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody FolderPatchRequest request) {
        return folderService.patch(principal, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        folderService.delete(principal, id);
    }
}
