package com.lms.controller;

import com.lms.dto.UserDto;
import com.lms.model.ParentLink;
import com.lms.model.User;
import com.lms.service.AccessGuard;
import com.lms.service.ParentService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/parent")
@RequiredArgsConstructor
public class ParentController {

    private final ParentService parentService;
    private final AccessGuard accessGuard;

    private User caller(UserDetails principal) {
        return accessGuard.requireUser(principal.getUsername());
    }

    @GetMapping("/children")
    @PreAuthorize("hasRole('PARENT')")
    public ResponseEntity<List<UserDto>> children(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(parentService.getChildren(caller(principal)));
    }

    /**
     * Aggregate progress for one child. The link is verified inside the service,
     * so holding the PARENT role alone grants nothing.
     */
    @GetMapping("/children/{studentId}/report")
    @PreAuthorize("hasRole('PARENT')")
    public ResponseEntity<ParentService.ChildReport> report(@PathVariable Long studentId,
                                                            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(parentService.getChildReport(caller(principal), studentId));
    }

    @PostMapping("/link")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<ParentLink> link(@RequestBody LinkRequest request,
                                           @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(parentService.link(
                request.getParentId(), request.getStudentId(),
                request.getRelationship(), caller(principal)));
    }

    @Data
    public static class LinkRequest {
        private Long parentId;
        private Long studentId;
        private String relationship;
    }
}
