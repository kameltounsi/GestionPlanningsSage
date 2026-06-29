package com.gestionplanning.ecr;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AppUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class PhaseSoundAlertService {
    private final PhaseSoundAlertRepository alertRepository;
    private final AccessControlService accessControlService;

    public PhaseSoundAlertService(PhaseSoundAlertRepository alertRepository, AccessControlService accessControlService) {
        this.alertRepository = alertRepository;
        this.accessControlService = accessControlService;
    }

    @Transactional
    public void notifyPhaseApproved(EcrRequest request, EcrStage approvedStage, EcrStage openedStage) {
        if (request == null || approvedStage == null) {
            return;
        }
        accessControlService.projectLeadFor(request)
                .filter(user -> !isBlank(user.getEmail()))
                .ifPresent(user -> alertRepository.save(newAlert(request, approvedStage, openedStage, user)));
    }

    @Transactional
    public List<PhaseSoundAlert> pendingSoundAlertsFor(AppUser user) {
        if (user == null || isBlank(user.getEmail())) {
            return new ArrayList<>();
        }
        return alertRepository.findByRecipientEmailAndSoundAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(normalizeEmail(user.getEmail()));
    }

    @Transactional
    public void acknowledgeSoundAlerts(AppUser user, List<Long> ids) {
        if (user == null || isBlank(user.getEmail()) || ids == null || ids.isEmpty()) {
            return;
        }
        String email = normalizeEmail(user.getEmail());
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        List<PhaseSoundAlert> alerts = alertRepository.findAllById(ids).stream()
                .filter(alert -> email.equals(normalizeEmail(alert.getRecipientEmail())))
                .collect(Collectors.toList());
        alerts.forEach(alert -> alert.setSoundAcknowledgedAt(now));
        alertRepository.saveAll(alerts);
    }

    private PhaseSoundAlert newAlert(EcrRequest request, EcrStage approvedStage, EcrStage openedStage, AppUser recipient) {
        PhaseSoundAlert alert = new PhaseSoundAlert();
        alert.setRequest(request);
        alert.setRequestId(request.getId());
        alert.setRecipientEmail(normalizeEmail(recipient.getEmail()));
        alert.setRecipientName(displayName(recipient));
        alert.setApprovedStage(approvedStage);
        alert.setOpenedStage(openedStage);
        alert.setRequestLabel(requestLabel(request));
        alert.setApprovedPhaseLabel(approvedStage.getLabel(request.isNewVersion()));
        alert.setOpenedPhaseLabel(openedPhaseLabel(request, approvedStage, openedStage));
        alert.setCreatedAt(LocalDateTime.now(ZoneId.systemDefault()));
        return alert;
    }

    private String openedPhaseLabel(EcrRequest request, EcrStage approvedStage, EcrStage openedStage) {
        if (openedStage == null || openedStage == approvedStage) {
            return "Demande de cloture";
        }
        return openedStage.getLabel(request.isNewVersion());
    }

    private String requestLabel(EcrRequest request) {
        if (request == null) return "-";
        if (!isBlank(request.getModificationNumber())) return request.getModificationNumber().trim();
        if (!isBlank(request.getClient())) return request.getClient().trim();
        return "Modification " + request.getId();
    }

    private String displayName(AppUser user) {
        return user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName();
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
