package com.gestionplanning.ecr;

import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AccountMailService;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WeeklyModificationProgressMailServiceTest {

    @Test
    void weeklyMailProcessesOnlyActiveModifications() {
        EcrRequestRepository requestRepository = mock(EcrRequestRepository.class);
        EcrActionRepository actionRepository = mock(EcrActionRepository.class);
        AccessControlService accessControlService = mock(AccessControlService.class);
        AccountMailService mailService = mock(AccountMailService.class);

        EcrRequest active = new EcrRequest();
        EcrRequest archived = new EcrRequest();
        archived.setArchived(true);
        EcrRequest closedByStatus = new EcrRequest();
        closedByStatus.setClosureStatus(true);
        EcrRequest closedByStage = new EcrRequest();
        closedByStage.setCurrentStage(EcrStage.CLOSED);
        EcrRequest cancelled = new EcrRequest();
        cancelled.setCancelledStatus(true);

        when(requestRepository.findByArchivedFalseOrderByReceptionDateDescIdDesc())
                .thenReturn(Arrays.asList(active, archived, closedByStatus, closedByStage, cancelled));
        when(actionRepository.findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(isNull()))
                .thenReturn(Collections.emptyList());
        when(accessControlService.adminsFor()).thenReturn(Collections.emptyList());

        WeeklyModificationProgressMailService service = new WeeklyModificationProgressMailService(
                requestRepository, actionRepository, accessControlService, mailService, true);

        service.sendWeeklyProgressEmails();

        verify(actionRepository).findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(isNull());
        verify(mailService, never()).sendModificationProgressExcelEmail(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString());
    }
}
