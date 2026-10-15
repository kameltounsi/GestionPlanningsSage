package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrTemplateService;
import com.gestionplanning.ecr.PhaseValidationRequestRepository;
import com.gestionplanning.ecr.PhaseValidationStatus;
import com.gestionplanning.storage.CloudinaryStorageService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Set;

@Service
public class ActionPlanningRulePropagationService {
    private final EcrRequestRepository requestRepository;
    private final ActionPlanningService planningService;
    private final CloudinaryStorageService storageService;
    private final EcrTemplateService templateService;
    private final PhaseValidationRequestRepository validations;

    public ActionPlanningRulePropagationService(EcrRequestRepository requestRepository, ActionPlanningService planningService,
                                                CloudinaryStorageService storageService, EcrTemplateService templateService,
                                                PhaseValidationRequestRepository validations) {
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.storageService = storageService;
        this.templateService = templateService;
        this.validations = validations;
    }

    @Transactional
    public void addRuleToExistingRequests(ActionPlanningRule rule) {
        // Archived requests follow the same phase eligibility rules as active requests.
        requestRepository.findAll().stream()
                .filter(request -> canAddToStage(request, rule.getStage()))
                .forEach(request -> templateService.addNewRuleFor(request, rule, stage -> canAddToStage(request, stage)));
    }

    private boolean canAddToStage(EcrRequest request, EcrStage stage) {
        if (request.isClosureStatus() || request.getCurrentStage() == EcrStage.CLOSED
                || request.getCurrentStage() == EcrStage.CANCELLED || stage == null) return false;
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int current = stages.indexOf(request.getCurrentStage());
        if (current < 0 || stages.indexOf(stage) < current) return false;
        return validations.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(request.getId(), stage)
                .map(validation -> validation.getStatus() != PhaseValidationStatus.APPROVED).orElse(true);
    }

    @Async
    @Transactional
    public void recalculateRequests(Set<Long> requestIds) {
        if (requestIds == null || requestIds.isEmpty()) {
            return;
        }
        requestRepository.findAllById(requestIds).stream()
                .filter(request -> request.getCurrentStage() != EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CANCELLED)
                .forEach(planningService::recalculateRequest);
    }

    @Async
    public void deleteCloudAssets(List<CloudAssetReference> assets) {
        for (CloudAssetReference asset : assets == null ? Collections.<CloudAssetReference>emptyList() : assets) {
            storageService.deleteQuietly(asset.publicId, asset.resourceType);
        }
    }

    public static class CloudAssetReference {
        private final String publicId;
        private final String resourceType;

        public CloudAssetReference(String publicId, String resourceType) {
            this.publicId = publicId;
            this.resourceType = resourceType;
        }
    }
}
