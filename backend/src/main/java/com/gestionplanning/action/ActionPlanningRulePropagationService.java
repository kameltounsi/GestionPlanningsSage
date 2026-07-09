package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
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

    public ActionPlanningRulePropagationService(EcrRequestRepository requestRepository, ActionPlanningService planningService,
                                                CloudinaryStorageService storageService) {
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.storageService = storageService;
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
