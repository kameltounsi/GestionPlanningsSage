package com.gestionplanning.auth;

import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AccessControlServiceTest {
    private final ProjectReferenceRepository projectRepository = mock(ProjectReferenceRepository.class);
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final EcrActionRepository actionRepository = mock(EcrActionRepository.class);
    private final AccessControlService service = new AccessControlService(projectRepository, userRepository, actionRepository);

    @Test
    void filterPersonalRequestsDoesNotExposeRequestsByGenericRoleOnly() {
        AppUser user = user("Alice Worker", "alice@example.com", "Qualite");
        EcrRequest directRequest = request(1L, "MOD-1", "Project A", "Other Pilot");
        EcrRequest genericRoleRequest = request(2L, "MOD-2", "Project B", "Other Pilot");
        EcrAction directAction = action(directRequest, "Alice Worker");
        EcrAction genericRoleAction = action(genericRoleRequest, "Qualite");

        when(projectRepository.findById(anyString())).thenReturn(Optional.empty());
        when(actionRepository.findByRequest_IdInOrderByRequest_IdAscStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(
                org.mockito.ArgumentMatchers.anyCollection()))
                .thenReturn(Arrays.asList(directAction, genericRoleAction));

        List<EcrRequest> result = service.filterPersonalRequests(user, Arrays.asList(directRequest, genericRoleRequest));

        assertEquals(Collections.singletonList(directRequest), result);
    }

    @Test
    void projectTeamMemberCanReadEveryActionInTheModification() {
        AppUser user = user("Alice Worker", "alice@example.com", "Qualite");
        EcrRequest request = request(3L, "MOD-3", "Project C", "Other Pilot");
        ProjectReference project = new ProjectReference();
        project.setName("Project C");
        project.setProjectTeam("Alice Worker::Qualite; Bob Worker::Production");
        EcrAction otherUsersAction = action(request, "Bob Worker");

        when(projectRepository.findById("Project C")).thenReturn(Optional.of(project));

        assertTrue(service.canAccessRequest(user, request));
        assertTrue(service.canSeeAllActions(user, request));
        assertTrue(service.canViewAction(user, otherUsersAction));
    }

    private AppUser user(String fullName, String email, String role) {
        AppUser user = new AppUser();
        user.setFullName(fullName);
        user.setEmail(email);
        user.setUsername(email.split("@", 2)[0]);
        user.setRole(role);
        user.setJobTitle(role);
        user.setEnabled(true);
        return user;
    }

    private EcrRequest request(Long id, String modificationNumber, String project, String pilot) {
        EcrRequest request = new EcrRequest();
        ReflectionTestUtils.setField(request, "id", id);
        request.setModificationNumber(modificationNumber);
        request.setModificationProject(project);
        request.setPilot(pilot);
        return request;
    }

    private EcrAction action(EcrRequest request, String responsible) {
        EcrAction action = new EcrAction();
        action.setRequest(request);
        action.setResponsible(responsible);
        return action;
    }
}
