package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AppUser;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TimelineReferenceControllerTest {
    @Test
    void sameTimelineHasIndependentCommentsForEachModification() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.gestionplanning.ecr.EcrRequest first = mapper.readValue(
            "{\"timelines\":[{\"name\":\"Prototype\",\"comment\":\"Essai client A\"}]}",
            com.gestionplanning.ecr.EcrRequestDto.class).toEntity();
        com.gestionplanning.ecr.EcrRequest second = mapper.readValue(
            "{\"timelines\":[{\"name\":\"Prototype\",\"comment\":\"Essai client B\"}]}",
            com.gestionplanning.ecr.EcrRequestDto.class).toEntity();
        second.getTimelines().get(0).setComment("Commentaire modifie pour B");
        String firstJson = mapper.writeValueAsString(com.gestionplanning.ecr.EcrRequestDto.from(first));
        String secondJson = mapper.writeValueAsString(com.gestionplanning.ecr.EcrRequestDto.from(second));
        assertEquals("Essai client A", mapper.readTree(firstJson).get("timelines").get(0).get("comment").asText());
        assertEquals("Commentaire modifie pour B", mapper.readTree(secondJson).get("timelines").get(0).get("comment").asText());
    }

    @Test
    void multipleTimelinesKeepTheirOwnCommentsAndCanBeCleared() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.gestionplanning.ecr.EcrRequestDto dto = mapper.readValue(
            "{\"timelines\":[{\"name\":\"Prototype\",\"comment\":\"Premier jalon\"},{\"name\":\"Serie\",\"comment\":\"Second jalon\"}]}",
            com.gestionplanning.ecr.EcrRequestDto.class);
        com.gestionplanning.ecr.EcrRequest entity = dto.toEntity();
        String json = mapper.writeValueAsString(com.gestionplanning.ecr.EcrRequestDto.from(entity));
        assertEquals(2, mapper.readTree(json).get("timelines").size());
        assertEquals("Premier jalon", mapper.readTree(json).get("timelines").get(0).get("comment").asText());
        assertEquals("Second jalon", mapper.readTree(json).get("timelines").get(1).get("comment").asText());
        entity.setTimelineName("Ancienne timeline");
        entity.setTimelines(java.util.Collections.emptyList());
        assertTrue(entity.getTimelines().isEmpty());
        assertNull(entity.getTimelineName());
    }

    @Test
    void modificationJsonRoundTripPreservesTimelineSnapshot() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.gestionplanning.ecr.EcrRequestDto dto = mapper.readValue(
            "{\"timelineName\":\"Prototype\",\"timelineComment\":\"Avant validation\"}",
            com.gestionplanning.ecr.EcrRequestDto.class);
        com.gestionplanning.ecr.EcrRequest entity = dto.toEntity();
        assertEquals("Prototype", entity.getTimelineName());
        assertEquals("Avant validation", entity.getTimelineComment());
        String json = mapper.writeValueAsString(com.gestionplanning.ecr.EcrRequestDto.from(entity));
        assertEquals("Avant validation", mapper.readTree(json).get("timelineComment").asText());
        assertEquals("Prototype", mapper.readTree(json).get("timelineName").asText());
    }

    @Test
    void preservesReferenceCommentOnCreateAndUpdate() {
        when(access.isAdmin(user)).thenReturn(true);
        when(repository.save(any(TimelineReference.class))).thenAnswer(call -> call.getArgument(0));
        ReferenceDto input = new ReferenceDto(null, "Phase");
        input.setComment("Explication initiale");
        assertEquals("Explication initiale", controller.create(input, user).getBody().getComment());
        when(repository.findById(1L)).thenReturn(Optional.of(new TimelineReference()));
        input.setComment("Nouvelle explication");
        assertEquals("Nouvelle explication", controller.update(1L, input, user).getBody().getComment());
    }

    private final TimelineReferenceRepository repository = mock(TimelineReferenceRepository.class);
    private final AccessControlService access = mock(AccessControlService.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final AppUser user = new AppUser();
    private final TimelineReferenceController controller = new TimelineReferenceController(repository, audit, access);

    @Test
    void rejectsAllWritesForNonAdministrators() {
        assertEquals(403, controller.create(new ReferenceDto(null, "Phase"), user).getStatusCodeValue());
        assertEquals(403, controller.update(1L, new ReferenceDto(null, "Phase"), user).getStatusCodeValue());
        assertEquals(403, controller.delete(1L, user).getStatusCodeValue());
        verifyNoInteractions(repository, audit);
    }

    @Test
    void savesTrimmedNamesAndUpdatesExistingEntries() {
        when(access.isAdmin(user)).thenReturn(true);
        when(repository.save(any(TimelineReference.class))).thenAnswer(call -> call.getArgument(0));
        assertEquals("Phase", controller.create(new ReferenceDto(null, " Phase "), user).getBody().getName());
        TimelineReference entity = new TimelineReference();
        when(repository.findById(1L)).thenReturn(Optional.of(entity));
        assertEquals("Jalon", controller.update(1L, new ReferenceDto(null, " Jalon "), user).getBody().getName());
        assertEquals(404, controller.update(2L, new ReferenceDto(null, "Phase"), user).getStatusCodeValue());
    }

    @Test
    void deletesOnlyExistingEntries() {
        when(access.isAdmin(user)).thenReturn(true);
        assertEquals(404, controller.delete(1L, user).getStatusCodeValue());
        verify(repository, never()).deleteById(anyLong());
        when(repository.existsById(1L)).thenReturn(true);
        assertEquals(204, controller.delete(1L, user).getStatusCodeValue());
        verify(repository).deleteById(1L);
    }
}
