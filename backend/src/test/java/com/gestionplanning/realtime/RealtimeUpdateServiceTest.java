package com.gestionplanning.realtime;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class RealtimeUpdateServiceTest {
    private final RealtimeWebSocketHandler webSocketHandler = mock(RealtimeWebSocketHandler.class);
    private final RealtimeUpdateService service = new RealtimeUpdateService(webSocketHandler);

    @Test
    void publishPlanningUpdatedBroadcastsPathPayload() {
        service.publishPlanningUpdated("/planning");

        verify(webSocketHandler).broadcast(eq("planning-updated"), eq(Map.of("path", "/planning")));
    }

    @Test
    void publishChatMessageBroadcastsStringPayload() {
        service.publishChatMessage(12L, 3L, 4L);

        verify(webSocketHandler).broadcast(eq("chat-message"), eq(Map.of(
                "messageId", "12",
                "senderId", "3",
                "recipientId", "4"
        )));
    }

    @Test
    void publishChatMessageUsesEmptyStringsForNullValues() {
        service.publishChatMessage(null, null, null);

        verify(webSocketHandler).broadcast(eq("chat-message"), eq(Map.of(
                "messageId", "",
                "senderId", "",
                "recipientId", ""
        )));
    }

    @Test
    void publishChatTypingBroadcastsActiveState() {
        service.publishChatTyping(7L, "User", "group", 2L, true);

        verify(webSocketHandler).broadcast(eq("chat-typing"), eq(Map.of(
                "senderId", "7",
                "senderName", "User",
                "targetType", "group",
                "targetId", "2",
                "active", "true"
        )));
    }

    @Test
    void subscribeReturnsEmitterAndBroadcastStillWorks() {
        assertEquals(0L, service.subscribe().getTimeout());

        service.publishChatPresence(15L);

        verify(webSocketHandler).broadcast(eq("chat-presence"), eq(Map.of("userId", "15")));
    }
}
