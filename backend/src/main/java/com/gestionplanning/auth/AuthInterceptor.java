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
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        String token = authorization.substring("Bearer ".length()).trim();
        return tokenRepository.findByTokenAndExpiresAtAfter(token, LocalDateTime.now())
                .filter(authToken -> authToken.getUser().isEnabled())
                .map(authToken -> {
                    request.setAttribute("authenticatedUser", authToken.getUser());
                    if (isAdminOnlyRequest(request) && !accessControlService.isAdmin(authToken.getUser())) {
                        try {
                            response.sendError(HttpServletResponse.SC_FORBIDDEN);
                        } catch (Exception ignored) {
                        }
                        return false;
                    }
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
        if (HttpMethod.GET.matches(method) && path.matches("/api/action-assets/\\d+/download")) {
            return true;
        }
        if (HttpMethod.GET.matches(method) && path.matches("/api/actions/\\d+/proof-document")) {
            return true;
        }
        if (HttpMethod.GET.matches(method) && path.matches("/api/action-planning-rules/\\d+/proof-document")) {
            return true;
        }
        if (HttpMethod.GET.matches(method) && path.matches("/api/ecr-requests/\\d+/files/(before|after)/download")) {
            return true;
        }
        return HttpMethod.GET.matches(method) && path.matches("/api/actions/\\d+/evidence");
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
        if (path.matches("/api/projects(/.*)?")) {
            return true;
        }
        if (path.matches("/api/preferentials/(clients|products|roles)(/.*)?")) {
            return true;
        }
        if (path.matches("/api/action-planning-rules(/.*)?")) {
            return true;
        }
        return HttpMethod.POST.matches(method) && path.matches("/api/ecr-requests/\\d+/actions")
                || HttpMethod.DELETE.matches(method) && path.matches("/api/actions/\\d+");
    }
}
