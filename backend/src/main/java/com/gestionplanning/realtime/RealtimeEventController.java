package com.gestionplanning.realtime;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/events")
public class RealtimeEventController {
    private final JdbcTemplate jdbcTemplate;
    private final RealtimeUpdateService realtimeUpdateService;

    public RealtimeEventController(JdbcTemplate jdbcTemplate, RealtimeUpdateService realtimeUpdateService) {
        this.jdbcTemplate = jdbcTemplate;
        this.realtimeUpdateService = realtimeUpdateService;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> subscribe(@RequestParam String token) {
        return isValidToken(token)
                ? ResponseEntity.ok(realtimeUpdateService.subscribe())
                : ResponseEntity.status(401).build();
    }

    private boolean isValidToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            return false;
        }
        try {
            Boolean valid = jdbcTemplate.queryForObject(
                    "select exists ("
                            + "select 1 from auth_token t "
                            + "join app_user u on u.id = t.user_id "
                            + "where t.token = ? and t.expires_at > now() and u.enabled = true"
                            + ")",
                    Boolean.class,
                    token.trim()
            );
            return Boolean.TRUE.equals(valid);
        } catch (EmptyResultDataAccessException exception) {
            return false;
        }
    }
}
