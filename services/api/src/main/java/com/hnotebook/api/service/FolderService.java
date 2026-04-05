package com.hnotebook.api.service;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.hnotebook.api.domain.Folder;
import com.hnotebook.api.domain.User;
import com.hnotebook.api.repo.FolderRepository;
import com.hnotebook.api.repo.UserRepository;
import com.hnotebook.api.security.UserPrincipal;
import com.hnotebook.api.web.dto.FolderDtos.FolderCreateRequest;
import com.hnotebook.api.web.dto.FolderDtos.FolderPatchRequest;
import com.hnotebook.api.web.dto.FolderDtos.FolderResponse;

@Service
public class FolderService {

    private final FolderRepository folderRepository;
    private final UserRepository userRepository;

    public FolderService(FolderRepository folderRepository, UserRepository userRepository) {
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<FolderResponse> list(UserPrincipal principal) {
        User user = loadUser(principal);
        return folderRepository.findByUserOrderByNameAsc(user).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FolderResponse create(UserPrincipal principal, FolderCreateRequest request) {
        User user = loadUser(principal);
        Folder parent = null;
        if (request.parentId() != null) {
            parent = folderRepository.findByIdAndUser_Id(request.parentId(), user.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent folder not found"));
        }
        Folder folder = new Folder(user, request.name().trim(), parent);
        folderRepository.save(folder);
        return toResponse(folder);
    }

    @Transactional
    public FolderResponse patch(UserPrincipal principal, UUID id, FolderPatchRequest request) {
        Folder folder = folderRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
        if (request.name() != null) {
            folder.setName(request.name().trim());
        }
        if (Boolean.TRUE.equals(request.clearParent())) {
            folder.setParent(null);
        } else if (request.parentId() != null) {
            if (request.parentId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folder cannot be its own parent");
            }
            Folder parent = folderRepository.findByIdAndUser_Id(request.parentId(), principal.id())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent folder not found"));
            folder.setParent(parent);
        }
        return toResponse(folder);
    }

    @Transactional
    public void delete(UserPrincipal principal, UUID id) {
        Folder folder = folderRepository.findByIdAndUser_Id(id, principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
        if (folderRepository.countByParent_Id(id) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Folder still has subfolders");
        }
        folderRepository.delete(folder);
    }

    private User loadUser(UserPrincipal principal) {
        return userRepository.findById(principal.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private FolderResponse toResponse(Folder folder) {
        UUID parentId = folder.getParent() != null ? folder.getParent().getId() : null;
        return new FolderResponse(folder.getId(), folder.getName(), parentId, folder.getCreatedAt());
    }
}
