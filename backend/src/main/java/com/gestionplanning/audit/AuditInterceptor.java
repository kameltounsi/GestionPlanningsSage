package com.gestionplanning.audit;

import com.gestionplanning.user.AppUser;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuditInterceptor implements HandlerInterceptor {
    private final AuditLogService auditLogService;

    public AuditInterceptor(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        return;
    }

    private boolean shouldSkip(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        return HttpMethod.GET.matches(method)
                || HttpMethod.OPTIONS.matches(method)
                || path.equals("/api/auth/login")
                || path.matches("/api/audit(/.*)?");
    }
}
