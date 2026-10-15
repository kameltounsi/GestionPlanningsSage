package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.user.AppUser;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ActionSchedulePermissionsTest {
    @Test
    void administratorsAndProjectLeadsCanPlanOnlyUnfinishedActions() throws Exception {
        EcrActionController controller = mock(EcrActionController.class, CALLS_REAL_METHODS);
        AccessControlService access = mock(AccessControlService.class);
        Field field = EcrActionController.class.getDeclaredField("accessControlService");
        field.setAccessible(true);
        field.set(controller, access);
        Method permission = EcrActionController.class.getDeclaredMethod("canUpdateDuration", AppUser.class, EcrAction.class);
        permission.setAccessible(true);
        AppUser user = new AppUser();
        EcrRequest request = new EcrRequest();
        EcrAction action = new EcrAction();
        action.setRequest(request);
        action.setStage(EcrStage.FEASIBILITY_VALIDATION);
        assertEquals(false, permission.invoke(controller, user, action));
        when(access.isAdmin(user)).thenReturn(true);
        assertEquals(true, permission.invoke(controller, user, action));
        when(access.isAdmin(user)).thenReturn(false);
        when(access.isProjectLeadForRequest(user, request)).thenReturn(true);
        assertEquals(true, permission.invoke(controller, user, action));
        for (ActionStatus status : new ActionStatus[]{ActionStatus.DONE, ActionStatus.DONE_LATE}) {
            action.setStatus(status);
            assertEquals(false, permission.invoke(controller, user, action));
            when(access.isAdmin(user)).thenReturn(true);
            assertEquals(false, permission.invoke(controller, user, action));
        }
        action.setStatus(ActionStatus.TODO);
        action.setChecked(true);
        assertEquals(false, permission.invoke(controller, user, action));
        action.setChecked(false);
        request.setCurrentStage(EcrStage.CLOSED);
        assertEquals(false, permission.invoke(controller, user, action));
    }
}
