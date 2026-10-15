package com.gestionplanning.user;

import com.gestionplanning.action.*;
import com.gestionplanning.ecr.*;
import org.junit.jupiter.api.Test;
import javax.mail.*;
import javax.mail.internet.MimeMessage;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class AccountMailLinkTest {
    @Test
    void everyMailUsesRequiredAddressDespiteLegacyConfiguration() throws Exception {
        List<MimeMessage> sent = new ArrayList<>();
        AccountMailService service = new AccountMailService("localhost", 25, "sender@example.test", "test-password",
                false, false, false, false, "http://VM_IP_OR_DOMAIN:3000", true, true) {
            @Override void deliverMessage(MimeMessage message) throws MessagingException { message.saveChanges(); sent.add(message); }
        };
        AppUser user = new AppUser(); user.setEmail("validator@example.test"); user.setFullName("Validateur");
        EcrRequest request = new EcrRequest(); request.setModificationNumber("MOD-42");
        EcrAction action = new EcrAction(); action.setTitle("Contrôle production");
        EcrStage stage = EcrStage.FEASIBILITY_VALIDATION;
        List<AppUser> recipients = Collections.singletonList(user);
        service.sendAccountCreatedEmail(user, "temporary");
        service.sendPasswordResetCodeEmail(user, "123456");
        service.sendPhaseReadyEmail(request, stage, recipients);
        service.sendActionValidationEmail(request, stage, action, user);
        service.sendActionRejectedEmail(request, stage, action, user, "À corriger");
        service.sendActionDeadlineEmail(request, action, user, "Échéance", "Demain");
        service.sendPhaseRejectedEmail(request, stage, user, "À corriger", "Contrôle");
        service.sendModificationCompletedEmail(request, recipients);
        service.sendModificationClosureRequestedEmail(request, user, recipients);
        service.sendModificationProgressExcelEmail(request, recipients, new byte[] {1}, "rapport.xlsx");
        ActionDurationAlert duration = new ActionDurationAlert(); duration.setRecipientEmail(user.getEmail());
        service.sendActionDurationChangedEmail(duration);
        ActionStartDateAlert date = new ActionStartDateAlert(); date.setRecipientEmail(user.getEmail());
        date.setActionTitle("Contrôle <production>"); date.setPreviousDate(LocalDate.of(2026, 10, 15));
        date.setNewDate(LocalDate.of(2026, 10, 20)); service.sendActionStartDateChangedEmail(date);
        ActionDeletionAlert deleted = new ActionDeletionAlert(); deleted.setRecipientEmail(user.getEmail());
        deleted.setActionTitle("Contrôle production"); deleted.setRequestLabel("MOD-42");
        deleted.setPhaseLabel("Validation client"); deleted.setProjectLead("Chef Exemple"); deleted.setChangedBy("Admin Exemple");
        service.sendActionDeletedEmail(deleted);
        assertEquals(13, sent.size());
        for (MimeMessage message : sent) checkParts(message);
        String dateText = (String) ((Multipart) sent.get(11).getContent()).getBodyPart(0).getContent();
        assertTrue(dateText.contains("15/10/2026")); assertTrue(dateText.contains("20/10/2026"));
        assertEquals(user.getEmail(), sent.get(11).getAllRecipients()[0].toString());
        String deletionText = (String) ((Multipart) sent.get(12).getContent()).getBodyPart(0).getContent();
        for (String expected : Arrays.asList("Contrôle production", "MOD-42", "Validation client", "Chef Exemple", "Admin Exemple")) {
            assertTrue(deletionText.contains(expected));
        }
    }

    private void checkParts(Part part) throws Exception {
        if (part.getContent() instanceof Multipart) {
            Multipart multipart = (Multipart) part.getContent();
            for (int i = 0; i < multipart.getCount(); i++) checkParts(multipart.getBodyPart(i));
        } else if (part.isMimeType("text/plain") || part.isMimeType("text/html")) {
            String body = (String) part.getContent();
            assertTrue(body.contains("http://192.168.1.117:3000"));
            assertFalse(body.contains("VM_IP_OR_DOMAIN"));
            if (part.isMimeType("text/html")) assertTrue(body.contains("href=\"http://192.168.1.117:3000\""));
        }
    }
}
