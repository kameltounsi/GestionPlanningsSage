package com.gestionplanning.dashboard;

import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionDto;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.user.AppUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final EcrRequestRepository requestRepository;
    private final EcrActionRepository actionRepository;
    private final AccessControlService accessControlService;

    public DashboardController(EcrRequestRepository requestRepository, EcrActionRepository actionRepository,
                               AccessControlService accessControlService) {
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/actions")
    public List<EcrActionDto> actions(@RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        List<EcrRequest> requests = accessControlService.filterPersonalRequests(
                user,
                requestRepository.findByArchivedFalseOrderByReceptionDateDescIdDesc()
        );
        if (requests.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> requestIds = requests.stream()
                .map(EcrRequest::getId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, EcrRequest> requestsById = requests.stream()
                .filter(request -> request.getId() != null)
                .collect(Collectors.toMap(EcrRequest::getId, request -> request, (first, second) -> first));
        if (requestIds.isEmpty()) {
            return Collections.emptyList();
        }
        boolean admin = accessControlService.isAdmin(user);
        return actionRepository.findByRequest_IdInOrderByRequest_IdAscStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(requestIds).stream()
                .filter(action -> canShowAction(admin, user, action, requestsById))
                .map(EcrActionDto::fromDashboardItem)
                .collect(Collectors.toList());
    }

    private boolean canShowAction(boolean admin, AppUser user, EcrAction action, Map<Long, EcrRequest> requestsById) {
        if (admin) {
            return true;
        }
        EcrRequest request = requestsById.get(action.getRequestId());
        return accessControlService.canSeeAllActions(user, request) || accessControlService.isActionParticipant(user, action);
    }
}
