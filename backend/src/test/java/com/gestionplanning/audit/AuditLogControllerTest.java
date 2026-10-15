package com.gestionplanning.audit;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.auth.AuthenticatedUserService;
import com.gestionplanning.user.AppUser;
import org.junit.jupiter.api.Test;
import java.util.Collections;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class AuditLogControllerTest {
    @Test
    void completeExportUsesFullHistoryOnlyForAdministrators() {
        AuditLogRepository repository = mock(AuditLogRepository.class);
        AccessControlService access = mock(AccessControlService.class);
        AuthenticatedUserService authenticated = mock(AuthenticatedUserService.class);
        AppUser user = new AppUser();
        when(authenticated.require(1L)).thenReturn(user);
        AuditLogController controller = new AuditLogController(repository, access, authenticated);
        assertEquals(403, controller.list(1L, true).getStatusCodeValue());
        verifyNoInteractions(repository);
        when(access.isAdmin(user)).thenReturn(true);
        when(repository.findAllByOrderByOccurredAtDescIdDesc()).thenReturn(Collections.emptyList());
        when(repository.findTop300ByOrderByOccurredAtDescIdDesc()).thenReturn(Collections.emptyList());
        assertEquals(200, controller.list(1L, true).getStatusCodeValue());
        verify(repository).findAllByOrderByOccurredAtDescIdDesc();
        assertEquals(200, controller.list(1L, false).getStatusCodeValue());
        verify(repository).findTop300ByOrderByOccurredAtDescIdDesc();
    }
}
