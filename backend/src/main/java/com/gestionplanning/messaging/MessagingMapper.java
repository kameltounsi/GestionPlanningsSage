package com.gestionplanning.messaging;

import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.user.AppUser;
import org.springframework.stereotype.Component;

@Component
public class MessagingMapper {
    private final CloudinaryStorageService storageService;

    public MessagingMapper(CloudinaryStorageService storageService) {
        this.storageService = storageService;
    }

    public MessagingController.ChatUserDto toChatUserDto(AppUser user, UserPresence presence, ChatMessage latestMessage) {
        return MessagingController.ChatUserDto.from(user, presence, toNullableMessageDto(latestMessage), storageService);
    }

    public MessagingController.ChatConversationDto toUserConversationDto(AppUser user, UserPresence presence, ChatMessage latestMessage, long unreadCount) {
        return MessagingController.ChatConversationDto.user(user, presence, toNullableMessageDto(latestMessage), unreadCount, storageService);
    }

    public MessagingController.ChatConversationDto toGroupConversationDto(ChatGroup group, ChatMessage latestMessage, long unreadCount) {
        return MessagingController.ChatConversationDto.group(group, toNullableMessageDto(latestMessage), unreadCount);
    }

    public MessagingController.ChatMessageDto toMessageDto(ChatMessage message) {
        return MessagingController.ChatMessageDto.from(message);
    }

    private MessagingController.ChatMessageDto toNullableMessageDto(ChatMessage message) {
        return message == null ? null : toMessageDto(message);
    }
}
