package com.gestionplanning.user;

import javax.persistence.*;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import java.time.LocalDateTime;
import java.time.ZoneId;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "app_user")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false)
    private String fullName;

    @Column(unique = true)
    private String username;

    private String jobTitle;

    @Pattern(regexp = "\\d*")
    @Column(unique = true)
    private String matricule;

    @Email
    @NotBlank
    @Column(nullable = false, unique = true)
    private String email;

    @NotBlank
    @Column(nullable = false)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @NotBlank
    @Column(nullable = false, unique = true)
    private String phone;

    private String chef1;

    private String chef2;

    private String profilePhotoFileName;
    private String profilePhotoContentType;
    private Long profilePhotoFileSize;
    @Column(length = 2000)
    private String profilePhotoUrl;
    private String profilePhotoPublicId;
    private String profilePhotoResourceType;

    @Column(nullable = false, length = 500)
    private String role = UserRole.CHEF_DE_PROJET.name();

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.systemDefault());

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now(ZoneId.systemDefault());

    public Long getId() {
        return id;
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

    public String getMatricule() {
        return matricule;
    }

    public void setMatricule(String matricule) {
        this.matricule = matricule;
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

    public String getProfilePhotoPublicId() {
        return profilePhotoPublicId;
    }

    public void setProfilePhotoPublicId(String profilePhotoPublicId) {
        this.profilePhotoPublicId = profilePhotoPublicId;
    }

    public String getProfilePhotoResourceType() {
        return profilePhotoResourceType;
    }

    public void setProfilePhotoResourceType(String profilePhotoResourceType) {
        this.profilePhotoResourceType = profilePhotoResourceType;
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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    @PrePersist
    public void beforeCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void beforeUpdate() {
        updatedAt = LocalDateTime.now(ZoneId.systemDefault());
    }
}
