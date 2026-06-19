package com.gestionplanning.realtime;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RealtimeUpdateService {
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        send(emitter, "connected", payload("connected"));
        return emitter;
    }

    public void publishPlanningUpdated(String path) {
        broadcast("planning-updated", payload(path));
    }

    private Map<String, String> payload(String path) {
        return java.util.Collections.singletonMap("path", path == null ? "" : path);
    }

    private void broadcast(String eventName, Object payload) {
        for (SseEmitter emitter : emitters) {
            send(emitter, eventName, payload);
        }
    }

    private void send(SseEmitter emitter, String eventName, Object payload) {
        try {
            emitter.send(SseEmitter.event()
                    .name(eventName)
                    .id(String.valueOf(Instant.now().toEpochMilli()))
                    .data(payload));
        } catch (IOException | IllegalStateException exception) {
            emitters.remove(emitter);
        }
    }
}
