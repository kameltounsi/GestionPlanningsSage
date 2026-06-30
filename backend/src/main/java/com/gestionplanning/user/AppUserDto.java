package com.gestionplanning.user;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public class AppUserDto {
    private Long id;

    @NotBlank
    private String fullName;

    private String username;
    private String jobTitle;

    @Email
    @NotBlank
    private String email;

    private String password;
    @NotBlank
    private String phone;
    private String chef1;
    private String chef2;
    private String profilePhotoFileName;
    private String profilePhotoContentType;
    private Long profilePhotoFileSize;
    private String profilePhotoUrl;
    private String role;
    private boolean enabled = true;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getChef1() {
        return chef1;
    }

    public void setChef1(String chef1) {
        this.chef1 = chef1;
    }

    public String getChef2() {
        return chef2;
    }

    public void setChef2(String chef2) {
        this.chef2 = chef2;
    }

    public String getProfilePhotoFileName() {
        return profilePhotoFileName;
    }

    public void setProfilePhotoFileName(String profilePhotoFileName) {
        this.profilePhotoFileName = profilePhotoFileName;
    }

    public String getProfilePhotoContentType() {
        return profilePhotoContentType;
    }

    public void setProfilePhotoContentType(String profilePhotoContentType) {
        this.profilePhotoContentType = profilePhotoContentType;
    }

    public Long getProfilePhotoFileSize() {
        return profilePhotoFileSize;
    }

    public void setProfilePhotoFileSize(Long profilePhotoFileSize) {
        this.profilePhotoFileSize = profilePhotoFileSize;
    }

    public String getProfilePhotoUrl() {
        return profilePhotoUrl;
    }

    public void setProfilePhotoUrl(String profilePhotoUrl) {
        this.profilePhotoUrl = profilePhotoUrl;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
