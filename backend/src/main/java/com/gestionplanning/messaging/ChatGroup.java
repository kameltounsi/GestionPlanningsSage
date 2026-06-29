package com.gestionplanning.messaging;

import com.gestionplanning.user.AppUser;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "chat_group")
public class ChatGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(length = 180)
    private String projectName;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "created_by_id", nullable = false)
    private AppUser createdBy;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "chat_group_member",
            joinColumns = @JoinColumn(name = "group_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<AppUser> members = new LinkedHashSet<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.systemDefault());

    @PrePersist
    public void beforeCreate() {
        createdAt = LocalDateTime.now(ZoneId.systemDefault());
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public Set<AppUser> getMembers() { return members; }
    public void setMembers(Set<AppUser> members) { this.members = members; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
