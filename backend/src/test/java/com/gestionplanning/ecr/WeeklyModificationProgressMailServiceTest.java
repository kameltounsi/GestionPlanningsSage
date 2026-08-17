package com.gestionplanning.ecr;

import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AccountMailService;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.time.LocalDate;

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
        active.setProgressMailIntervalDays(1);
        active.setProgressMailScheduleStartDate(LocalDate.now().minusDays(1));
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

    @Test
    void customIntervalsAreCalculatedFromReceptionDate() {
        WeeklyModificationProgressMailService service = service();
        EcrRequest request = new EcrRequest();
        request.setProgressMailScheduleStartDate(LocalDate.of(2026, 8, 1));
        request.setProgressMailIntervalDays(3);

        org.junit.jupiter.api.Assertions.assertFalse(service.isProgressMailDue(request, LocalDate.of(2026, 8, 1)));
        org.junit.jupiter.api.Assertions.assertTrue(service.isProgressMailDue(request, LocalDate.of(2026, 8, 4)));
        org.junit.jupiter.api.Assertions.assertTrue(service.isProgressMailDue(request, LocalDate.of(2026, 8, 7)));
        org.junit.jupiter.api.Assertions.assertFalse(service.isProgressMailDue(request, LocalDate.of(2026, 8, 8)));
    }

    @Test
    void nullIntervalKeepsMondaySchedule() {
        WeeklyModificationProgressMailService service = service();
        EcrRequest request = new EcrRequest();

        org.junit.jupiter.api.Assertions.assertTrue(service.isProgressMailDue(request, LocalDate.of(2026, 8, 17)));
        org.junit.jupiter.api.Assertions.assertFalse(service.isProgressMailDue(request, LocalDate.of(2026, 8, 18)));
    }

    private WeeklyModificationProgressMailService service() {
        return new WeeklyModificationProgressMailService(
                mock(EcrRequestRepository.class), mock(EcrActionRepository.class),
                mock(AccessControlService.class), mock(AccountMailService.class), true);
    }
}
