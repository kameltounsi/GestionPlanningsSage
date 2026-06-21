package com.gestionplanning.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class RealtimeWebSocketConfig implements WebSocketConfigurer {
    private final RealtimeWebSocketHandler realtimeWebSocketHandler;
    private final RealtimeWebSocketAuthInterceptor authInterceptor;

    public RealtimeWebSocketConfig(RealtimeWebSocketHandler realtimeWebSocketHandler, RealtimeWebSocketAuthInterceptor authInterceptor) {
        this.realtimeWebSocketHandler = realtimeWebSocketHandler;
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(realtimeWebSocketHandler, "/ws/events")
                .addInterceptors(authInterceptor)
                .setAllowedOrigins("*");
    }
}
