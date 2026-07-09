package com.gestionplanning.user;

import com.gestionplanning.storage.CloudinaryStorageService;
import org.springframework.stereotype.Component;

@Component
public class AppUserMapper {
    private final CloudinaryStorageService storageService;

    public AppUserMapper(CloudinaryStorageService storageService) {
        this.storageService = storageService;
    }

    public AppUser toEntity(AppUserDto dto) {
        AppUser user = new AppUser();
        if (dto == null) {
            return user;
        }
        user.setFullName(dto.getFullName());
        user.setUsername(dto.getUsername());
        user.setJobTitle(dto.getJobTitle());
        user.setMatricule(dto.getMatricule());
        user.setEmail(dto.getEmail());
        user.setPassword(dto.getPassword());
        user.setPhone(dto.getPhone());
        user.setChef1(dto.getChef1());
        user.setChef2(dto.getChef2());
        user.setRole(dto.getRole());
        user.setEnabled(dto.isEnabled());
        return user;
    }

    public AppUserDto toDto(AppUser user) {
        AppUserDto dto = new AppUserDto();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setUsername(user.getUsername());
        dto.setJobTitle(user.getJobTitle());
        dto.setMatricule(user.getMatricule());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setChef1(user.getChef1());
        dto.setChef2(user.getChef2());
        dto.setProfilePhotoFileName(user.getProfilePhotoFileName());
        dto.setProfilePhotoContentType(user.getProfilePhotoContentType());
        dto.setProfilePhotoFileSize(user.getProfilePhotoFileSize());
        dto.setProfilePhotoUrl(storageService.publicUrl(user.getProfilePhotoPublicId(), user.getProfilePhotoResourceType(), user.getProfilePhotoUrl()));
        dto.setRole(user.getRole());
        dto.setEnabled(user.isEnabled());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
    }

    public void copyAccountFields(AppUser source, AppUser target) {
        target.setFullName(source.getFullName());
        target.setUsername(source.getUsername());
        target.setJobTitle(source.getJobTitle());
        target.setMatricule(source.getMatricule());
        target.setEmail(source.getEmail());
        target.setPhone(source.getPhone());
        target.setChef1(source.getChef1());
        target.setChef2(source.getChef2());
        target.setRole(source.getRole());
        target.setEnabled(source.isEnabled());
    }
}
