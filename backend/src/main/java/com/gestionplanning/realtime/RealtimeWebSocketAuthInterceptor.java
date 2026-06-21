package com.gestionplanning.realtime;

import com.gestionplanning.auth.AuthTokenRepository;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.Map;

@Component
public class RealtimeWebSocketAuthInterceptor implements HandshakeInterceptor {
    private final AuthTokenRepository tokenRepository;

    public RealtimeWebSocketAuthInterceptor(AuthTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().getFirst("token");
        if (token == null || token.trim().isEmpty()) {
            return false;
        }
        return tokenRepository.findByTokenAndExpiresAtAfter(token.trim(), LocalDateTime.now())
                .filter(authToken -> authToken.getUser().isEnabled())
                .map(authToken -> {
                    attributes.put("authenticatedUserId", authToken.getUser().getId());
                    return true;
                })
                .orElse(false);
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
    }
}
