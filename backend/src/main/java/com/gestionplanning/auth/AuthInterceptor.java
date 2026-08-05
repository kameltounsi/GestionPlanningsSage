package com.gestionplanning.auth;

import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    private static final String[] PUBLIC_GET_PATTERNS = {
            "/api/documents/\\d+/download",
            "/api/action-assets/\\d+/download",
            "/api/action-proof-documents/\\d+/download",
            "/api/actions/\\d+/proof-document",
            "/api/action-planning-rules/\\d+/proof-document",
            "/api/action-planning-rules/proof-documents/\\d+/download",
            "/api/ecr-requests/\\d+/files/(before|after)/download",
            "/api/chat/messages/\\d+/attachment",
            "/api/actions/\\d+/evidence"
    };

    private final AuthTokenRepository tokenRepository;
    private final AccessControlService accessControlService;

    public AuthInterceptor(AuthTokenRepository tokenRepository, AccessControlService accessControlService) {
        this.tokenRepository = tokenRepository;
        this.accessControlService = accessControlService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (isPublicRequest(request)) {
            return true;
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        String token = authorization.substring("Bearer ".length()).trim();
        return tokenRepository.findByTokenAndExpiresAtAfter(token, LocalDateTime.now(ZoneId.systemDefault()))
                .filter(authToken -> authToken.getUser().isEnabled())
                .map(authToken -> {
                    request.setAttribute("authenticatedUser", authToken.getUser());
                    request.setAttribute("authenticatedUserId", authToken.getUser().getId());
                    if (isAdminOnlyRequest(request) && !accessControlService.isAdmin(authToken.getUser())) {
                        sendError(response, HttpServletResponse.SC_FORBIDDEN);
                        return false;
                    }
                    return true;
                })
                .orElseGet(() -> {
                    sendError(response, HttpServletResponse.SC_UNAUTHORIZED);
                    return false;
                });
    }

    private boolean isPublicRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        return HttpMethod.OPTIONS.matches(method)
                || "/api/auth/login".equals(path)
                || "/api/auth/sso".equals(path)
                || HttpMethod.POST.matches(method) && path.matches("/api/auth/password-reset/(request|verify|confirm)")
                || HttpMethod.GET.matches(method) && ("/api/events".equals(path) || "/ws/events".equals(path) || matchesAny(path, PUBLIC_GET_PATTERNS));
    }

    private void sendError(HttpServletResponse response, int status) {
        try {
            response.setStatus(status);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().write(status == HttpServletResponse.SC_UNAUTHORIZED
                    ? "Session expiree. Connectez-vous a nouveau."
                    : "Vous n'avez pas les droits pour effectuer cette action.");
        } catch (Exception ignored) {
            // Best-effort operation: the request will still be rejected.
        }
    }

    private boolean matchesAny(String path, String[] patterns) {
        for (String pattern : patterns) {
            if (path.matches(pattern)) {
                return true;
            }
        }
        return false;
    }

    private boolean isAdminOnlyRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (HttpMethod.GET.matches(method) || HttpMethod.OPTIONS.matches(method)) {
            return false;
        }
        if (path.matches("/api/users/\\d+/(profile|password|photo)")) {
            return false;
        }
        if (path.matches("/api/users(/.*)?")) {
            return true;
        }
        if (path.matches("/api/projects(/.*)?") && !HttpMethod.PUT.matches(method)) {
            return true;
        }
        if (path.matches("/api/preferentials/(clients|products|roles)(/.*)?")) {
            return true;
        }
        if (path.matches("/api/action-planning-rules(/.*)?")) {
            return true;
        }
        return false;
    }
}
