package com.gestionplanning.messaging;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.gestionplanning.user.AppUser;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "chat_message")
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sender_id", nullable = false)
    private AppUser sender;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "recipient_id")
    private AppUser recipient;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "group_id")
    private ChatGroup group;

    @Column(length = 5000)
    private String content;

    private String attachmentFileName;
    private String attachmentContentType;
    private Long attachmentFileSize;
    @Column(length = 2000)
    private String attachmentUrl;
    @JsonIgnore
    private String attachmentPublicId;
    @JsonIgnore
    private String attachmentResourceType;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.systemDefault());
    private LocalDateTime readAt;

    @PrePersist
    public void beforeCreate() {
        createdAt = LocalDateTime.now(ZoneId.systemDefault());
    }

    public Long getId() { return id; }
    public AppUser getSender() { return sender; }
    public void setSender(AppUser sender) { this.sender = sender; }
    public AppUser getRecipient() { return recipient; }
    public void setRecipient(AppUser recipient) { this.recipient = recipient; }
    public ChatGroup getGroup() { return group; }
    public void setGroup(ChatGroup group) { this.group = group; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getAttachmentFileName() { return attachmentFileName; }
    public void setAttachmentFileName(String attachmentFileName) { this.attachmentFileName = attachmentFileName; }
    public String getAttachmentContentType() { return attachmentContentType; }
    public void setAttachmentContentType(String attachmentContentType) { this.attachmentContentType = attachmentContentType; }
    public Long getAttachmentFileSize() { return attachmentFileSize; }
    public void setAttachmentFileSize(Long attachmentFileSize) { this.attachmentFileSize = attachmentFileSize; }
    public String getAttachmentUrl() { return attachmentUrl; }
    public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }
    public String getAttachmentPublicId() { return attachmentPublicId; }
    public void setAttachmentPublicId(String attachmentPublicId) { this.attachmentPublicId = attachmentPublicId; }
    public String getAttachmentResourceType() { return attachmentResourceType; }
    public void setAttachmentResourceType(String attachmentResourceType) { this.attachmentResourceType = attachmentResourceType; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
}
