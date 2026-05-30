package com.gestionplanning.auth;

import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final AuthTokenRepository tokenRepository;

    public AuthInterceptor(AuthTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (isPublicRequest(request)) {
            return true;
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        String token = authorization.substring("Bearer ".length()).trim();
        return tokenRepository.findByTokenAndExpiresAtAfter(token, LocalDateTime.now())
                .filter(authToken -> authToken.getUser().isEnabled())
                .map(authToken -> {
                    request.setAttribute("authenticatedUser", authToken.getUser());
                    return true;
                })
                .orElseGet(() -> {
                    try {
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                    } catch (Exception ignored) {
                    }
                    return false;
                });
    }

    private boolean isPublicRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (HttpMethod.OPTIONS.matches(method)) {
            return true;
        }
        if ("/api/auth/login".equals(path)) {
            return true;
        }
        if (HttpMethod.GET.matches(method) && path.matches("/api/documents/\\d+/download")) {
            return true;
        }
        return HttpMethod.GET.matches(method) && path.matches("/api/actions/\\d+/evidence");
    }
}
