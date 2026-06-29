package com.gestionplanning.messaging;

import com.gestionplanning.realtime.RealtimeUpdateService;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
public class MessagingController {
    private static final int ONLINE_TIMEOUT_MINUTES = 10;
    private static final String GROUP_TARGET_TYPE = "group";
    private final AppUserRepository userRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatGroupRepository groupRepository;
    private final ChatGroupReadStateRepository groupReadStateRepository;
    private final UserPresenceRepository presenceRepository;
    private final CloudinaryStorageService storageService;
    private final RealtimeUpdateService realtimeUpdateService;

    public MessagingController(AppUserRepository userRepository, ChatMessageRepository messageRepository,
                               ChatGroupRepository groupRepository, ChatGroupReadStateRepository groupReadStateRepository, UserPresenceRepository presenceRepository,
                               CloudinaryStorageService storageService, RealtimeUpdateService realtimeUpdateService) {
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.groupRepository = groupRepository;
        this.groupReadStateRepository = groupReadStateRepository;
        this.presenceRepository = presenceRepository;
        this.storageService = storageService;
        this.realtimeUpdateService = realtimeUpdateService;
    }

    @GetMapping("/conversations")
    public List<ChatConversationDto> conversations(@RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        Map<Long, ChatMessage> latestByPeer = messageRepository.recentDirectForUser(currentUser.getId()).stream()
                .collect(Collectors.toMap(message -> peerId(message, currentUser), message -> message, (first, second) -> first, LinkedHashMap::new));
        List<ChatConversationDto> conversations = new ArrayList<>();
        userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> !user.getId().equals(currentUser.getId()))
                .map(user -> ChatConversationDto.user(user, onlinePresence(user), latestByPeer.get(user.getId()), directUnreadCount(currentUser, user)))
                .forEach(conversations::add);
        groupRepository.findForUser(currentUser.getId()).stream()
                .map(group -> ChatConversationDto.group(group, messageRepository.recentForGroup(group.getId()).stream().findFirst().orElse(null), groupUnreadCount(group, currentUser)))
                .forEach(conversations::add);
        conversations.sort((first, second) -> {
            LocalDateTime firstDate = first.sortDate();
            LocalDateTime secondDate = second.sortDate();
            if (firstDate != null && secondDate != null) {
                int result = secondDate.compareTo(firstDate);
                if (result != 0) return result;
            } else if (firstDate != null) {
                return -1;
            } else if (secondDate != null) {
                return 1;
            }
            return String.valueOf(first.getName()).compareToIgnoreCase(String.valueOf(second.getName()));
        });
        return conversations;
    }

    @GetMapping("/users")
    public List<ChatUserDto> users(@RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        Map<Long, ChatMessage> latestByPeer = messageRepository.recentDirectForUser(currentUser.getId()).stream()
                .collect(Collectors.toMap(message -> peerId(message, currentUser), message -> message, (first, second) -> first, LinkedHashMap::new));
        return userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> !user.getId().equals(currentUser.getId()))
                .map(user -> ChatUserDto.from(user, onlinePresence(user), latestByPeer.get(user.getId())))
                .sorted(Comparator.comparing(ChatUserDto::isOnline).reversed()
                        .thenComparing(dto -> dto.getFullName() == null ? "" : dto.getFullName(), String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    @GetMapping("/messages/{peerId}")
    @Transactional
    public ResponseEntity<List<ChatMessageDto>> messages(@PathVariable Long peerId, @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        return userRepository.findById(peerId)
                .filter(AppUser::isEnabled)
                .map(peer -> {
                    List<ChatMessage> messages = messageRepository.conversation(currentUser.getId(), peer.getId());
                    LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
                    messages.stream()
                            .filter(message -> message.getRecipient() != null && message.getRecipient().getId().equals(currentUser.getId()))
                            .filter(message -> message.getReadAt() == null)
                            .forEach(message -> message.setReadAt(now));
                    return ResponseEntity.ok(messages.stream().map(ChatMessageDto::from).collect(Collectors.toList()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/groups/{groupId}/messages")
    @Transactional
    public ResponseEntity<List<ChatMessageDto>> groupMessages(@PathVariable Long groupId, @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        return groupRepository.findById(groupId)
                .filter(group -> isGroupMember(group, currentUser))
                .map(group -> {
                    markGroupRead(group, currentUser);
                    return ResponseEntity.ok(messageRepository.groupConversation(group.getId()).stream()
                            .map(ChatMessageDto::from)
                            .collect(Collectors.toList()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/groups")
    @Transactional
    public ResponseEntity<ChatConversationDto> createGroup(@RequestBody CreateGroupRequest request,
                                                           @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
                                                               AppUser currentUser = (AppUser) currentUserAttribute;
        if (request == null) {
            return ResponseEntity.badRequest().build();
        }
        String name = request.getName() == null ? "" : request.getName().trim();
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Set<Long> requestedIds = request.getMemberIds() == null ? new LinkedHashSet<>() : new LinkedHashSet<>(request.getMemberIds());
        requestedIds.add(currentUser.getId());
        Set<AppUser> members = userRepository.findAllById(requestedIds).stream()
                .filter(AppUser::isEnabled)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (members.size() < 2) {
            return ResponseEntity.badRequest().build();
        }
        ChatGroup group = new ChatGroup();
        group.setName(name);
        group.setProjectName(request.getProjectName() == null ? "" : request.getProjectName().trim());
        group.setCreatedBy(currentUser);
        group.setMembers(members);
        ChatGroup saved = groupRepository.save(group);
        realtimeUpdateService.publishChatGroupMessage(null, currentUser.getId(), saved.getId());
        return ResponseEntity.ok(ChatConversationDto.group(saved, null, 0));
    }

    @PostMapping("/groups/{groupId}/members")
    @Transactional
    public ResponseEntity<ChatConversationDto> addGroupMember(@PathVariable Long groupId,
                                                              @RequestBody AddGroupMemberRequest request,
                                                              @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
                                                                  AppUser currentUser = (AppUser) currentUserAttribute;
        if (request == null || request.getUserId() == null) {
            return ResponseEntity.badRequest().build();
        }
        Optional<AppUser> userToAdd = userRepository.findById(request.getUserId()).filter(AppUser::isEnabled);
        if (!userToAdd.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        return groupRepository.findById(groupId)
                .filter(group -> isGroupMember(group, currentUser))
                .map(group -> {
                    group.getMembers().add(userToAdd.get());
                    ChatGroup saved = groupRepository.save(group);
                    afterCommit(() -> realtimeUpdateService.publishChatGroupMessage(null, currentUser.getId(), saved.getId()));
                    return ResponseEntity.ok(ChatConversationDto.group(saved, messageRepository.recentForGroup(saved.getId()).stream().findFirst().orElse(null), groupUnreadCount(saved, currentUser)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<ChatMessageDto> send(@RequestParam Long recipientId,
                                               @RequestParam(required = false) String content,
                                               @RequestParam(required = false) MultipartFile file,
                                               @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
                                                   AppUser currentUser = (AppUser) currentUserAttribute;
        return userRepository.findById(recipientId)
                .filter(AppUser::isEnabled)
                .map(recipient -> {
                    if (isEmptyMessage(content, file)) {
                        return ResponseEntity.badRequest().<ChatMessageDto>build();
                    }
                    ChatMessage message = new ChatMessage();
                    message.setSender(currentUser);
                    message.setRecipient(recipient);
                    message.setContent(content == null ? "" : content.trim());
                    if (file != null && !file.isEmpty()) {
                        fillAttachment(message, storageService.upload(file, "gestion-planning/chat/" + currentUser.getId() + "/" + recipient.getId()));
                    }
                    ChatMessage saved = messageRepository.save(message);
                    touch(currentUser, true);
                    afterCommit(() -> realtimeUpdateService.publishChatMessage(saved.getId(), currentUser.getId(), recipient.getId()));
                    return ResponseEntity.ok(ChatMessageDto.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/groups/{groupId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<ChatMessageDto> sendGroup(@PathVariable Long groupId,
                                                    @RequestParam(required = false) String content,
                                                    @RequestParam(required = false) MultipartFile file,
                                                    @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
                                                        AppUser currentUser = (AppUser) currentUserAttribute;
        return groupRepository.findById(groupId)
                .filter(group -> isGroupMember(group, currentUser))
                .map(group -> {
                    if (isEmptyMessage(content, file)) {
                        return ResponseEntity.badRequest().<ChatMessageDto>build();
                    }
                    ChatMessage message = new ChatMessage();
                    message.setSender(currentUser);
                    message.setRecipient(currentUser);
                    message.setGroup(group);
                    message.setContent(content == null ? "" : content.trim());
                    if (file != null && !file.isEmpty()) {
                        fillAttachment(message, storageService.upload(file, "gestion-planning/chat/groups/" + group.getId()));
                    }
                    ChatMessage saved = messageRepository.save(message);
                    touch(currentUser, true);
                    afterCommit(() -> realtimeUpdateService.publishChatGroupMessage(saved.getId(), currentUser.getId(), group.getId()));
                    return ResponseEntity.ok(ChatMessageDto.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/typing")
    public ResponseEntity<Void> typing(@RequestBody TypingRequest request, @RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        if (request == null || request.getTargetId() == null) {
            return ResponseEntity.badRequest().build();
        }
        String targetType = request.getTargetType() == null ? "user" : request.getTargetType();
        if (GROUP_TARGET_TYPE.equalsIgnoreCase(targetType)) {
            Optional<ChatGroup> group = groupRepository.findById(request.getTargetId());
            if (!group.isPresent() || !isGroupMember(group.get(), currentUser)) {
                return ResponseEntity.notFound().build();
            }
            realtimeUpdateService.publishChatTyping(currentUser.getId(), currentUser.getFullName(), GROUP_TARGET_TYPE, group.get().getId(), request.isActive());
            return ResponseEntity.noContent().build();
        }
        Optional<AppUser> recipient = userRepository.findById(request.getTargetId()).filter(AppUser::isEnabled);
        if (!recipient.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        realtimeUpdateService.publishChatTyping(currentUser.getId(), currentUser.getFullName(), "user", recipient.get().getId(), request.isActive());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/presence/heartbeat")
    public ResponseEntity<Void> heartbeat(@RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        touch(currentUser, true);
        realtimeUpdateService.publishChatPresence(currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/presence/offline")
    public ResponseEntity<Void> offline(@RequestAttribute("authenticatedUser") Object currentUserAttribute) {
        AppUser currentUser = (AppUser) currentUserAttribute;
        touch(currentUser, false);
        realtimeUpdateService.publishChatPresence(currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/messages/{messageId}/attachment")
    public ResponseEntity<Object> attachment(@PathVariable Long messageId) {
        return messageRepository.findByIdAndAttachmentUrlIsNotNull(messageId)
                .<ResponseEntity<Object>>map(message -> {
                    DownloadedAsset asset = storageService.download(
                            message.getAttachmentPublicId(),
                            message.getAttachmentResourceType(),
                            message.getAttachmentUrl(),
                            message.getAttachmentContentType()
                    );
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeFileName(message.getAttachmentFileName()) + "\"")
                            .contentType(MediaType.parseMediaType(asset.getContentType()))
                            .body(asset.getData());
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private boolean isEmptyMessage(String content, MultipartFile file) {
        return (content == null || content.trim().isEmpty()) && (file == null || file.isEmpty());
    }

    private UserPresence touch(AppUser user, boolean online) {
        UserPresence presence = presenceRepository.findByUser(user).orElseGet(() -> {
            UserPresence item = new UserPresence();
            item.setUser(user);
            return item;
        });
        presence.setOnline(online);
        presence.setLastSeenAt(LocalDateTime.now(ZoneId.systemDefault()));
        return presenceRepository.save(presence);
    }

    private UserPresence onlinePresence(AppUser user) {
        Optional<UserPresence> presence = presenceRepository.findByUser(user);
        if (!presence.isPresent()) {
            return null;
        }
        UserPresence item = presence.get();
        boolean fresh = item.getLastSeenAt() != null && item.getLastSeenAt().isAfter(LocalDateTime.now(ZoneId.systemDefault()).minusMinutes(ONLINE_TIMEOUT_MINUTES));
        if (item.isOnline() && !fresh) {
            item.setOnline(false);
            presenceRepository.save(item);
        }
        return item;
    }

    private Long peerId(ChatMessage message, AppUser user) {
        return message.getSender().getId().equals(user.getId()) ? message.getRecipient().getId() : message.getSender().getId();
    }

    private boolean isGroupMember(ChatGroup group, AppUser user) {
        return group.getMembers().stream().anyMatch(member -> member.getId().equals(user.getId()));
    }

    private void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private long directUnreadCount(AppUser currentUser, AppUser peer) {
        return messageRepository.conversation(currentUser.getId(), peer.getId()).stream()
                .filter(message -> message.getRecipient() != null && message.getRecipient().getId().equals(currentUser.getId()))
                .filter(message -> message.getReadAt() == null)
                .count();
    }

    private long groupUnreadCount(ChatGroup group, AppUser user) {
        Optional<ChatGroupReadState> state = groupReadStateRepository.findByGroupAndUser(group, user);
        return state.map(readState -> {
            LocalDateTime lastReadAt = readState.getLastReadAt();
            if (lastReadAt == null) {
                return messageRepository.countByGroup_IdAndSender_IdNot(group.getId(), user.getId());
            }
            return messageRepository.countByGroup_IdAndSender_IdNotAndCreatedAtAfter(group.getId(), user.getId(), lastReadAt);
        }).orElseGet(() -> messageRepository.countByGroup_IdAndSender_IdNot(group.getId(), user.getId()));
    }

    private void markGroupRead(ChatGroup group, AppUser user) {
        ChatGroupReadState state = groupReadStateRepository.findByGroupAndUser(group, user).orElseGet(() -> {
            ChatGroupReadState item = new ChatGroupReadState();
            item.setGroup(group);
            item.setUser(user);
            return item;
        });
        state.setLastReadAt(LocalDateTime.now(ZoneId.systemDefault()));
        groupReadStateRepository.save(state);
    }

    private void fillAttachment(ChatMessage message, StoredAsset asset) {
        message.setAttachmentFileName(asset.getFileName());
        message.setAttachmentContentType(asset.getContentType());
        message.setAttachmentFileSize(asset.getSize());
        message.setAttachmentUrl(asset.getUrl());
        message.setAttachmentPublicId(asset.getPublicId());
        message.setAttachmentResourceType(asset.getResourceType());
    }

    private String safeFileName(String value) {
        return value == null ? "attachment" : value.replace("\"", "");
    }

    public static class ChatUserDto {
        private Long id;
        private String fullName;
        private String username;
        private String jobTitle;
        private String profilePhotoUrl;
        private boolean online;
        private LocalDateTime lastSeenAt;
        private ChatMessageDto latestMessage;

        public static ChatUserDto from(AppUser user, UserPresence presence, ChatMessage latestMessage) {
            ChatUserDto dto = new ChatUserDto();
            dto.id = user.getId();
            dto.fullName = user.getFullName();
            dto.username = user.getUsername();
            dto.jobTitle = user.getJobTitle();
            dto.profilePhotoUrl = user.getProfilePhotoUrl();
            dto.online = presence != null && presence.isOnline();
            dto.lastSeenAt = presence == null ? null : presence.getLastSeenAt();
            dto.latestMessage = latestMessage == null ? null : ChatMessageDto.from(latestMessage);
            return dto;
        }

        public Long getId() { return id; }
        public String getFullName() { return fullName; }
        public String getUsername() { return username; }
        public String getJobTitle() { return jobTitle; }
        public String getProfilePhotoUrl() { return profilePhotoUrl; }
        public boolean isOnline() { return online; }
        public LocalDateTime getLastSeenAt() { return lastSeenAt; }
        public ChatMessageDto getLatestMessage() { return latestMessage; }
    }

    public static class ChatConversationDto {
        private Long id;
        private String type;
        private String name;
        private String username;
        private String jobTitle;
        private String profilePhotoUrl;
        private boolean online;
        private LocalDateTime lastSeenAt;
        private String projectName;
        private int memberCount;
        private long unreadCount;
        private List<Long> memberIds = new ArrayList<>();
        private ChatMessageDto latestMessage;

        public static ChatConversationDto user(AppUser user, UserPresence presence, ChatMessage latestMessage, long unreadCount) {
            ChatConversationDto dto = new ChatConversationDto();
            dto.id = user.getId();
            dto.type = "user";
            dto.name = user.getFullName();
            dto.username = user.getUsername();
            dto.jobTitle = user.getJobTitle();
            dto.profilePhotoUrl = user.getProfilePhotoUrl();
            dto.online = presence != null && presence.isOnline();
            dto.lastSeenAt = presence == null ? null : presence.getLastSeenAt();
            dto.memberCount = 1;
            dto.unreadCount = unreadCount;
            dto.latestMessage = latestMessage == null ? null : ChatMessageDto.from(latestMessage);
            return dto;
        }

        public static ChatConversationDto group(ChatGroup group, ChatMessage latestMessage, long unreadCount) {
            ChatConversationDto dto = new ChatConversationDto();
            dto.id = group.getId();
            dto.type = GROUP_TARGET_TYPE;
            dto.name = group.getName();
            dto.projectName = group.getProjectName();
            dto.memberCount = group.getMembers().size();
            dto.unreadCount = unreadCount;
            dto.memberIds = group.getMembers().stream().map(AppUser::getId).collect(Collectors.toList());
            dto.latestMessage = latestMessage == null ? null : ChatMessageDto.from(latestMessage);
            return dto;
        }

        public LocalDateTime sortDate() {
            return latestMessage == null ? null : latestMessage.getCreatedAt();
        }

        public Long getId() { return id; }
        public String getType() { return type; }
        public String getName() { return name; }
        public String getFullName() { return name == null ? "" : name; }
        public String getUsername() { return username; }
        public String getJobTitle() { return jobTitle; }
        public String getProfilePhotoUrl() { return profilePhotoUrl; }
        public boolean isOnline() { return online; }
        public LocalDateTime getLastSeenAt() { return lastSeenAt; }
        public String getProjectName() { return projectName; }
        public int getMemberCount() { return memberCount; }
        public long getUnreadCount() { return unreadCount; }
        public List<Long> getMemberIds() { return memberIds; }
        public ChatMessageDto getLatestMessage() { return latestMessage; }
    }

    public static class ChatMessageDto {
        private Long id;
        private Long senderId;
        private Long recipientId;
        private Long groupId;
        private String senderName;
        private String recipientName;
        private String groupName;
        private String content;
        private String attachmentFileName;
        private String attachmentContentType;
        private Long attachmentFileSize;
        private String attachmentUrl;
        private LocalDateTime createdAt;
        private LocalDateTime readAt;

        public static ChatMessageDto from(ChatMessage message) {
            ChatMessageDto dto = new ChatMessageDto();
            dto.id = message.getId();
            dto.senderId = message.getSender().getId();
            dto.recipientId = message.getRecipient() == null ? null : message.getRecipient().getId();
            dto.groupId = message.getGroup() == null ? null : message.getGroup().getId();
            dto.senderName = message.getSender().getFullName();
            dto.recipientName = message.getRecipient() == null ? null : message.getRecipient().getFullName();
            dto.groupName = message.getGroup() == null ? null : message.getGroup().getName();
            dto.content = message.getContent();
            dto.attachmentFileName = message.getAttachmentFileName();
            dto.attachmentContentType = message.getAttachmentContentType();
            dto.attachmentFileSize = message.getAttachmentFileSize();
            dto.attachmentUrl = message.getAttachmentUrl();
            dto.createdAt = message.getCreatedAt();
            dto.readAt = message.getReadAt();
            return dto;
        }

        public Long getId() { return id; }
        public Long getSenderId() { return senderId; }
        public Long getRecipientId() { return recipientId; }
        public Long getGroupId() { return groupId; }
        public String getSenderName() { return senderName; }
        public String getRecipientName() { return recipientName; }
        public String getGroupName() { return groupName; }
        public String getContent() { return content; }
        public String getAttachmentFileName() { return attachmentFileName; }
        public String getAttachmentContentType() { return attachmentContentType; }
        public Long getAttachmentFileSize() { return attachmentFileSize; }
        public String getAttachmentUrl() { return attachmentUrl; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public LocalDateTime getReadAt() { return readAt; }
    }

    public static class CreateGroupRequest {
        private String name;
        private String projectName;
        private List<Long> memberIds = new ArrayList<>();

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getProjectName() { return projectName; }
        public void setProjectName(String projectName) { this.projectName = projectName; }
        public List<Long> getMemberIds() { return memberIds; }
        public void setMemberIds(List<Long> memberIds) { this.memberIds = memberIds; }
    }

    public static class AddGroupMemberRequest {
        private Long userId;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
    }

    public static class TypingRequest {
        private String targetType;
        private Long targetId;
        private boolean active = true;

        public String getTargetType() { return targetType; }
        public void setTargetType(String targetType) { this.targetType = targetType; }
        public Long getTargetId() { return targetId; }
        public void setTargetId(Long targetId) { this.targetId = targetId; }
        public boolean isActive() { return active; }
        public void setActive(boolean active) { this.active = active; }
    }
}
