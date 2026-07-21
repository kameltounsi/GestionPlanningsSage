package com.gestionplanning.user;

import com.gestionplanning.action.EcrAction;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrStage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.mail.Authenticator;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.activation.DataHandler;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMultipart;
import javax.mail.util.ByteArrayDataSource;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AccountMailService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AccountMailService.class);
    private static final String EMAIL_CHARSET = "UTF-8";
    private static final String HTML_CONTENT_TYPE = "text/html; charset=" + EMAIL_CHARSET;
    private static final String TEXT_LINK_LINE = "\nLien : ";
    private static final String TEXT_PROJECT_LINE = "\nProjet : ";
    private static final String TEXT_MODIFICATION_NAME_LINE = "\nNom de la modification : ";
    private static final String HTML_CLIENT_FIELD = "<br><strong>Client :</strong> ";
    private static final String HTML_PRODUCT_FIELD = "<br><strong>Produit :</strong> ";
    private static final String HTML_PROJECT_FIELD = "<br><strong>Projet :</strong> ";
    private static final String SMTP_TIMEOUT_MS = "10000";

    private final String host;
    private final int port;
    private final String fromAddress;
    private final String password;
    private final boolean smtpAuth;
    private final boolean startTlsEnabled;
    private final boolean startTlsRequired;
    private final boolean sslEnabled;
    private final String applicationUrl;
    private final boolean accountMailEnabled;
    private final boolean alertMailEnabled;

    public AccountMailService(@Value("${spring.mail.host:smtp.gmail.com}") String host,
                              @Value("${spring.mail.port:587}") int port,
                              @Value("${spring.mail.username:}") String fromAddress,
                              @Value("${spring.mail.password:}") String password,
                              @Value("${spring.mail.properties.mail.smtp.auth:true}") boolean smtpAuth,
                              @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}") boolean startTlsEnabled,
                              @Value("${spring.mail.properties.mail.smtp.starttls.required:true}") boolean startTlsRequired,
                              @Value("${spring.mail.properties.mail.smtp.ssl.enable:false}") boolean sslEnabled,
                              @Value("${app.frontend.url:http://192.168.1.117:3000}") String applicationUrl,
                              @Value("${app.account.mail.enabled:true}") boolean accountMailEnabled,
                              @Value("${app.alert.mail.enabled:true}") boolean alertMailEnabled) {
        this.host = host;
        this.port = port;
        this.fromAddress = fromAddress;
        this.password = password;
        this.smtpAuth = smtpAuth;
        this.startTlsEnabled = startTlsEnabled;
        this.startTlsRequired = startTlsRequired;
        this.sslEnabled = sslEnabled;
        this.applicationUrl = applicationUrl;
        this.accountMailEnabled = accountMailEnabled;
        this.alertMailEnabled = alertMailEnabled;
    }

    public void sendAccountCreatedEmail(AppUser user, String temporaryPassword) {
        if (!accountMailEnabled) {
            throw new MailDeliveryException("L'envoi email est désactivé par APP_ACCOUNT_MAIL_ENABLED.");
        }
        sendAccountCreatedEmailQuietly(user, temporaryPassword);
    }

    public void sendAccountCreatedEmailQuietly(AppUser user, String temporaryPassword) {
        if (!accountMailEnabled) {
            return;
        }
        if (user == null || isBlank(user.getEmail())) {
            LOGGER.warn("Account creation email skipped because recipient email is missing.");
            return;
        }
        if (!isMailConfigured()) {
            LOGGER.error("Account creation email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }

        try {
            MimeMessage message = new MimeMessage(mailSession());
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(user.getEmail()));
            message.setFrom(new InternetAddress(fromAddress));
            message.setSubject("Vos accès Gestion Planning Sage", EMAIL_CHARSET);
            message.setContent(buildContent(user, temporaryPassword));
            Transport.send(message);
            LOGGER.info("Account creation email sent to {}", user.getEmail());
        } catch (MessagingException | RuntimeException exception) {
            LOGGER.error("Unable to send account creation email to {}", user.getEmail(), exception);
            throw new MailDeliveryException("échec d'envoi email: " + rootMessage(exception), exception);
        }
    }

    public void sendPhaseReadyEmail(EcrRequest request, EcrStage stage, Collection<AppUser> recipients) {
        if (request == null || request.isArchived()) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipients == null || recipients.isEmpty()) {
            throw new MailDeliveryException("Aucun validateur/manager destinataire pour l'email de validation.");
        }
        String to = recipients.stream()
                .map(AppUser::getEmail)
                .filter(email -> !isBlank(email))
                .distinct()
                .collect(Collectors.joining(","));
        if (isBlank(to)) {
            throw new MailDeliveryException("Les validateurs/managers n'ont pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Phase validation email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String title = "Phase prête à valider";
        String text = "La phase " + value(stage == null ? null : stage.getLabel(request.isNewVersion()))
                + " de la modification " + value(request.getModificationNumber())
                + " est prête à être validée." + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#111827;color:#ffffff;padding:24px 30px;\">"
                + "<div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Phase prête à valider</h1>"
                + "</div><div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>La phase <strong>" + escape(stage == null ? "-" : stage.getLabel(request.isNewVersion())) + "</strong> de la modification <strong>" + escape(value(request.getModificationNumber())) + "</strong> est prête pour validation.</p>"
                + "<p><strong>Projet :</strong> " + escape(value(request.getModificationProject())) + HTML_CLIENT_FIELD + escape(value(request.getClient())) + HTML_PRODUCT_FIELD + escape(value(request.getProduct())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Ouvrir la modification</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(to, title, text, html, "phase validation");
    }

    public void sendActionValidationEmail(EcrRequest request, EcrStage stage, EcrAction action, AppUser recipient) {
        if (request == null || request.isArchived() || action == null) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipient == null || isBlank(recipient.getEmail())) {
            throw new MailDeliveryException("Le destinataire de validation n'a pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Action validation email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String title = "Action prête à valider";
        String text = "L'action " + value(action.getTitle())
                + " de la phase " + value(stage == null ? null : stage.getLabel(request.isNewVersion()))
                + " est prête à être validée.\nModification : " + value(request.getModificationNumber())
                + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#111827;color:#ffffff;padding:24px 30px;\">"
                + "<div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Action prête à valider</h1>"
                + "</div><div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>L'action <strong>" + escape(value(action.getTitle())) + "</strong> est prête pour validation.</p>"
                + "<p><strong>Phase :</strong> " + escape(stage == null ? "-" : stage.getLabel(request.isNewVersion())) + "<br><strong>Modification :</strong> " + escape(value(request.getModificationNumber())) + HTML_PROJECT_FIELD + escape(value(request.getModificationProject())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Ouvrir la modification</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(recipient.getEmail(), title, text, html, "action validation");
    }

    public void sendActionRejectedEmail(EcrRequest request, EcrStage stage, EcrAction action, AppUser recipient, String reason) {
        if (request == null || request.isArchived() || action == null) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipient == null || isBlank(recipient.getEmail())) {
            throw new MailDeliveryException("Le destinataire du refus d'action n'a pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Action rejection email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String phase = stage == null ? "-" : stage.getLabel(request.isNewVersion());
        String modificationName = modificationName(request);
        String title = "Action refusée - révision requise";
        String text = "L'action " + value(action.getTitle())
                + " a été refusée et doit être revisitée."
                + "\nMotif du refus : " + value(reason)
                + "\nModification : " + value(request.getModificationNumber())
                + TEXT_MODIFICATION_NAME_LINE + value(modificationName)
                + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + "\nPhase : " + value(phase)
                + "\nPilote action : " + value(action.getResponsible())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#7f1d1d;color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fecaca;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Action refusée</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>L'action <strong>" + escape(value(action.getTitle())) + "</strong> a été refusée et doit être revisitée.</p>"
                + "<p><strong>Motif du refus :</strong><br>" + escape(value(reason)).replace("\n", "<br>") + "</p>"
                + "<p><strong>Modification :</strong> " + escape(value(request.getModificationNumber())) + "<br><strong>Nom de la modification :</strong> " + escape(value(modificationName)) + HTML_PROJECT_FIELD + escape(value(request.getModificationProject())) + "<br><strong>Phase :</strong> " + escape(value(phase)) + "<br><strong>Pilote action :</strong> " + escape(value(action.getResponsible())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#b42318;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Revisiter l'action</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(recipient.getEmail(), title, text, html, "action rejection");
    }

    public void sendActionDeadlineEmail(EcrRequest request, EcrAction action, AppUser recipient, String timingLabel, String timingMessage) {
        sendActionDeadlineEmail(request, action, recipient, null, timingLabel, timingMessage);
    }

    public void sendActionDeadlineEmail(EcrRequest request, EcrAction action, AppUser recipient, Collection<AppUser> ccRecipients, String timingLabel, String timingMessage) {
        sendActionDeadlineEmail(request, action, recipient, ccRecipients, timingLabel, timingMessage, false);
    }

    public void sendActionDeadlineEmail(EcrRequest request, EcrAction action, AppUser recipient, Collection<AppUser> ccRecipients, String timingLabel, String timingMessage, boolean escalation) {
        if (request == null || request.isArchived() || action == null) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipient == null || isBlank(recipient.getEmail())) {
            throw new MailDeliveryException("Le pilote destinataire n'a pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Action deadline email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String phase = action.getStage() == null ? "-" : action.getStage().getLabel(request.isNewVersion());
        String modificationName = modificationName(request);
        String alertTitle = escalation ? "Escalation : Alerte échéance action" : "Alerte échéance action";
        String headerBackground = "#7f1d1d";
        String headerAccent = "#fecaca";
        String buttonBackground = "#b42318";
        String title = alertTitle + " - " + value(timingLabel);
        String text = value(timingMessage)
                + "\nAction : " + value(action.getTitle())
                + "\nDate de fin : " + value(action.getEndDate() == null ? null : action.getEndDate().toString())
                + "\nModification : " + value(request.getModificationNumber())
                + TEXT_MODIFICATION_NAME_LINE + value(modificationName)
                + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + "\nPhase : " + value(phase)
                + "\nPilote action : " + value(action.getResponsible())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:" + headerBackground + ";color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:" + headerAccent + ";\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">" + escape(alertTitle) + "</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p><strong>" + escape(value(timingLabel)) + "</strong> - " + escape(value(timingMessage)) + "</p>"
                + "<p><strong>Action :</strong> " + escape(value(action.getTitle())) + "<br><strong>Date de fin :</strong> " + escape(value(action.getEndDate() == null ? null : action.getEndDate().toString())) + "<br><strong>Modification :</strong> " + escape(value(request.getModificationNumber())) + "<br><strong>Nom de la modification :</strong> " + escape(value(modificationName)) + HTML_PROJECT_FIELD + escape(value(request.getModificationProject())) + "<br><strong>Phase :</strong> " + escape(value(phase)) + "<br><strong>Pilote action :</strong> " + escape(value(action.getResponsible())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:" + buttonBackground + ";color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Ouvrir la modification</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(recipient.getEmail(), ccRecipients, title, text, html, "action deadline");
    }

    public void sendPhaseRejectedEmail(EcrRequest request, EcrStage stage, AppUser recipient, String reason, String actionsToRevisit) {
        if (request == null || request.isArchived()) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipient == null || isBlank(recipient.getEmail())) {
            throw new MailDeliveryException("Le chef de projet destinataire n'a pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Phase rejection email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String title = "Phase refusée - actions à revisiter";
        String text = "La phase " + value(stage == null ? null : stage.getLabel(request.isNewVersion()))
                + " de la modification " + value(request.getModificationNumber())
                + " a été refusée.\nRaison : " + value(reason)
                + "\nActions à revisiter: " + value(actionsToRevisit)
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#7f1d1d;color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fecaca;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Phase refusée</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>La phase <strong>" + escape(stage == null ? "-" : stage.getLabel(request.isNewVersion())) + "</strong> de la modification <strong>" + escape(value(request.getModificationNumber())) + "</strong> nécessite une reprise.</p>"
                + "<p><strong>Raison :</strong><br>" + escape(value(reason)) + "</p>"
                + "<p><strong>Actions à revisiter :</strong><br>" + escape(value(actionsToRevisit)).replace("\n", "<br>") + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#b42318;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Ouvrir la modification</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(recipient.getEmail(), title, text, html, "phase rejection");
    }

    public void sendModificationCompletedEmail(EcrRequest request, Collection<AppUser> recipients) {
        if (request == null || request.isArchived()) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipients == null || recipients.isEmpty()) {
            throw new MailDeliveryException("Aucun pilote/admin destinataire pour l'email de clôture.");
        }
        String to = recipients.stream()
                .map(AppUser::getEmail)
                .filter(email -> !isBlank(email))
                .distinct()
                .collect(Collectors.joining(","));
        if (isBlank(to)) {
            throw new MailDeliveryException("Le pilote et les admins n'ont pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Modification completion email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String modificationName = modificationName(request);
        String title = "Modification marquée terminée";
        String text = "La modification " + value(request.getModificationNumber())
                + " est marquée comme terminée."
                + TEXT_MODIFICATION_NAME_LINE + value(modificationName)
                + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + "\nClient : " + value(request.getClient())
                + "\nProduit : " + value(request.getProduct())
                + "\nDate de clôture : " + value(request.getClosureDate() == null ? null : request.getClosureDate().toString())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#14532d;color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#bbf7d0;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Modification terminée</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>La modification <strong>" + escape(value(request.getModificationNumber())) + "</strong> est maintenant marquée comme <strong>terminée</strong>.</p>"
                + "<p><strong>Nom de la modification :</strong> " + escape(value(modificationName)) + HTML_PROJECT_FIELD + escape(value(request.getModificationProject())) + HTML_CLIENT_FIELD + escape(value(request.getClient())) + HTML_PRODUCT_FIELD + escape(value(request.getProduct())) + "<br><strong>Date de clôture :</strong> " + escape(value(request.getClosureDate() == null ? null : request.getClosureDate().toString())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Ouvrir la modification</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(to, title, text, html, "modification completion");
    }

    public void sendModificationClosureRequestedEmail(EcrRequest request, AppUser requester, Collection<AppUser> recipients) {
        if (request == null || request.isArchived()) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est désactivé par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipients == null || recipients.isEmpty()) {
            throw new MailDeliveryException("Aucun admin destinataire pour l'email de demande de clôture.");
        }
        String to = recipients.stream()
                .map(AppUser::getEmail)
                .filter(email -> !isBlank(email))
                .distinct()
                .collect(Collectors.joining(","));
        if (isBlank(to)) {
            throw new MailDeliveryException("Les admins n'ont pas d'adresse email renseignée.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Modification closure request email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String requesterName = requester == null ? value(request.getClosureRequestedBy()) : value(requester.getFullName());
        String modificationName = modificationName(request);
        String title = "Demande de clôture de modification";
        String text = "Le pilote demande la clôture de la modification " + value(request.getModificationNumber())
                + TEXT_MODIFICATION_NAME_LINE + value(modificationName)
                + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + "\nPilote : " + value(requesterName)
                + "\nDate de demande : " + value(request.getClosureRequestedDate() == null ? null : request.getClosureRequestedDate().toString())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#1d4ed8;color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Demande de clôture</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>Le pilote <strong>" + escape(value(requesterName)) + "</strong> demande la clôture de la modification <strong>" + escape(value(request.getModificationNumber())) + "</strong>.</p>"
                + "<p><strong>Nom de la modification :</strong> " + escape(value(modificationName)) + HTML_PROJECT_FIELD + escape(value(request.getModificationProject())) + HTML_CLIENT_FIELD + escape(value(request.getClient())) + HTML_PRODUCT_FIELD + escape(value(request.getProduct())) + "<br><strong>Date de demande :</strong> " + escape(value(request.getClosureRequestedDate() == null ? null : request.getClosureRequestedDate().toString())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Marquer terminée</a></div>"
                + "</div></div></div></body></html>";
        sendMessage(to, title, text, html, "modification closure request");
    }

    public void sendPasswordResetCodeEmail(AppUser user, String code) {
        if (!accountMailEnabled) {
            throw new MailDeliveryException("L'envoi email est désactivé par APP_ACCOUNT_MAIL_ENABLED.");
        }
        if (user == null || isBlank(user.getEmail())) {
            return;
        }
        if (isBlank(code)) {
            throw new MailDeliveryException("Code de récupération manquant.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Password reset email skipped because SMTP configuration is incomplète.");
            throw new MailDeliveryException("Configuration SMTP incomplète: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String title = "Code de récupération mot de passe";
        String text = "Bonjour " + value(user.getFullName()) + ","
                + "\n\nVotre code de récupération Gestion Planning Sage est: " + value(code)
                + "\nCe code expire dans 10 minutes."
                + "\n\nSi vous n'avez pas demandé cette récupération, ignorez cet email.";
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#111827;color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Récupération du mot de passe</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>Bonjour <strong>" + escape(value(user.getFullName())) + "</strong>, utilisez le code ci-dessous pour vérifier votre identité.</p>"
                + "<div style=\"font-size:32px;letter-spacing:.35em;font-weight:800;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:22px 0;color:#111827;\">" + escape(value(code)) + "</div>"
                + "<p>Ce code expire dans <strong>10 minutes</strong>. Si vous n'avez pas demandé cette récupération, ignorez cet email.</p>"
                + "</div></div></div></body></html>";
        sendMessage(user.getEmail(), title, text, html, "password reset");
    }

    private void sendMessage(String to, String subject, String plainText, String html, String logContext) {
        sendMessage(to, null, subject, plainText, html, logContext);
    }

    public void sendModificationProgressExcelEmail(EcrRequest request, Collection<AppUser> recipients, byte[] excelContent, String filename) {
        if (request == null || request.isArchived()) {
            return;
        }
        if (!alertMailEnabled) {
            throw new MailDeliveryException("L'envoi des alertes email est desactive par APP_ALERT_MAIL_ENABLED.");
        }
        if (recipients == null || recipients.isEmpty()) {
            throw new MailDeliveryException("Aucun admin/chef de projet destinataire pour le dossier Excel.");
        }
        if (excelContent == null || excelContent.length == 0) {
            throw new MailDeliveryException("Le dossier Excel est vide.");
        }
        String to = recipients.stream()
                .map(AppUser::getEmail)
                .filter(email -> !isBlank(email))
                .distinct()
                .collect(Collectors.joining(","));
        if (isBlank(to)) {
            throw new MailDeliveryException("Les destinataires n'ont pas d'adresse email renseignee.");
        }
        if (!isMailConfigured()) {
            LOGGER.error("Weekly progress email skipped because SMTP configuration is incomplete.");
            throw new MailDeliveryException("Configuration SMTP incomplete: SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD sont obligatoires.");
        }
        String modificationName = modificationName(request);
        String title = "Avancement hebdomadaire - " + value(modificationName);
        String text = "Bonjour,\n\nVeuillez trouver ci-joint le dossier Excel mis a jour avec l'avancement actuel de la modification "
                + value(modificationName)
                + TEXT_PROJECT_LINE + value(request.getModificationProject())
                + "\nClient : " + value(request.getClient())
                + "\nProduit : " + value(request.getProduct())
                + TEXT_LINK_LINE + value(applicationUrl);
        String html = "<!doctype html><html><body style=\"margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:640px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#111827;color:#ffffff;padding:24px 30px;\"><div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:24px;\">Avancement hebdomadaire</h1></div>"
                + "<div style=\"padding:26px 30px;font-size:15px;line-height:1.7;\">"
                + "<p>Veuillez trouver ci-joint le dossier Excel mis a jour avec l'avancement actuel de la modification <strong>" + escape(value(modificationName)) + "</strong>.</p>"
                + "<p><strong>Projet :</strong> " + escape(value(request.getModificationProject())) + HTML_CLIENT_FIELD + escape(value(request.getClient())) + HTML_PRODUCT_FIELD + escape(value(request.getProduct())) + "</p>"
                + "<div style=\"text-align:center;margin:28px 0 8px;\"><a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;\">Ouvrir Gestion Planning</a></div>"
                + "</div></div></div></body></html>";
        sendMessageWithAttachment(to, title, text, html, excelContent, filename, "weekly modification progress");
    }

    private void sendMessage(String to, Collection<AppUser> ccRecipients, String subject, String plainText, String html, String logContext) {
        try {
            MimeMessage message = new MimeMessage(mailSession());
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
            String cc = ccAddresses(ccRecipients, to);
            if (!isBlank(cc)) {
                message.setRecipients(Message.RecipientType.CC, InternetAddress.parse(cc));
            }
            message.setFrom(new InternetAddress(fromAddress));
            message.setSubject(subject, EMAIL_CHARSET);
            message.setContent(buildContent(plainText, html));
            Transport.send(message);
            LOGGER.info("{} email sent to {}{}", logContext, to, isBlank(cc) ? "" : " cc " + cc);
        } catch (MessagingException | RuntimeException exception) {
            LOGGER.error("Unable to send {} email to {}", logContext, to, exception);
            throw new MailDeliveryException("Échec d'envoi email: " + rootMessage(exception), exception);
        }
    }

    private void sendMessageWithAttachment(String to, String subject, String plainText, String html, byte[] attachment,
                                           String filename, String logContext) {
        try {
            MimeMessage message = new MimeMessage(mailSession());
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
            message.setFrom(new InternetAddress(fromAddress));
            message.setSubject(subject, EMAIL_CHARSET);

            MimeMultipart mixed = new MimeMultipart("mixed");

            MimeBodyPart contentPart = new MimeBodyPart();
            contentPart.setContent(buildContent(plainText, html));
            mixed.addBodyPart(contentPart);

            MimeBodyPart attachmentPart = new MimeBodyPart();
            ByteArrayDataSource source = new ByteArrayDataSource(attachment, attachmentContentType(filename));
            attachmentPart.setDataHandler(new DataHandler(source));
            attachmentPart.setFileName(isBlank(filename) ? "dossier-avancement.xlsx" : filename);
            mixed.addBodyPart(attachmentPart);

            message.setContent(mixed);
            Transport.send(message);
            LOGGER.info("{} email sent to {} with attachment {}", logContext, to, filename);
        } catch (MessagingException | RuntimeException exception) {
            LOGGER.error("Unable to send {} email to {}", logContext, to, exception);
            throw new MailDeliveryException("Echec d'envoi email: " + rootMessage(exception), exception);
        }
    }

    private String attachmentContentType(String filename) {
        if (filename != null && filename.toLowerCase().endsWith(".xls")) {
            return "application/vnd.ms-excel; charset=UTF-8";
        }
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    private String ccAddresses(Collection<AppUser> ccRecipients, String to) {
        if (ccRecipients == null || ccRecipients.isEmpty()) {
            return "";
        }
        Set<String> excluded = new LinkedHashSet<>();
        if (!isBlank(to)) {
            for (String email : to.split(",")) {
                if (!isBlank(email)) {
                    excluded.add(email.trim().toLowerCase());
                }
            }
        }
        Set<String> addresses = ccRecipients.stream()
                .map(AppUser::getEmail)
                .filter(email -> !isBlank(email))
                .map(email -> email.trim().toLowerCase())
                .filter(email -> !excluded.contains(email))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return String.join(",", addresses);
    }

    private Session mailSession() {
        Properties properties = new Properties();
        properties.put("mail.smtp.host", host);
        properties.put("mail.smtp.port", String.valueOf(port));
        properties.put("mail.smtp.auth", String.valueOf(smtpAuth));
        properties.put("mail.smtp.starttls.enable", String.valueOf(startTlsEnabled));
        properties.put("mail.smtp.starttls.required", String.valueOf(startTlsRequired));
        properties.put("mail.smtp.ssl.enable", String.valueOf(sslEnabled));
        properties.put("mail.smtp.connectiontimeout", SMTP_TIMEOUT_MS);
        properties.put("mail.smtp.timeout", SMTP_TIMEOUT_MS);
        properties.put("mail.smtp.writetimeout", SMTP_TIMEOUT_MS);
        properties.put("mail.debug", "false");

        if (!smtpAuth) {
            return Session.getInstance(properties);
        }

        return Session.getInstance(properties, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(fromAddress, password);
            }
        });
    }

    private boolean isMailConfigured() {
        if (isBlank(host) || port <= 0 || isBlank(fromAddress)) {
            return false;
        }
        return !smtpAuth || !isBlank(password);
    }

    private String rootMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }

    private MimeMultipart buildContent(AppUser user, String temporaryPassword) throws MessagingException {
        return buildContent(buildPlainText(user, temporaryPassword), buildHtml(user, temporaryPassword));
    }

    private MimeMultipart buildContent(String plainTextValue, String htmlValue) throws MessagingException {
        MimeMultipart content = new MimeMultipart("alternative");

        MimeBodyPart plainText = new MimeBodyPart();
        plainText.setText(plainTextValue, EMAIL_CHARSET);
        content.addBodyPart(plainText);

        MimeBodyPart html = new MimeBodyPart();
        html.setContent(htmlValue, HTML_CONTENT_TYPE);
        content.addBodyPart(html);

        return content;
    }

    private String buildPlainText(AppUser user, String temporaryPassword) {
        StringBuilder text = new StringBuilder();
        text.append("Bonjour ").append(value(user.getFullName())).append(",\n\n");
        text.append("Votre compte Gestion Planning Sage a été créé.\n\n");
        text.append("Lien d'accès: ").append(value(applicationUrl)).append("\n");
        text.append("Nom complet: ").append(value(user.getFullName())).append("\n");
        text.append("Identifiant: ").append(value(user.getUsername())).append("\n");
        text.append("Email: ").append(value(user.getEmail())).append("\n");
        text.append("Mot de passe: ").append(value(temporaryPassword)).append("\n");
        text.append("Rôle: ").append(value(user.getRole())).append("\n");
        text.append("Poste: ").append(value(user.getJobTitle())).append("\n");
        text.append("Téléphone: ").append(value(user.getPhone())).append("\n");
        text.append("Statut: ").append(user.isEnabled() ? "Actif" : "Inactif").append("\n\n");
        text.append("Pour votre sécurité, changez votre mot de passe après la première connexion.\n");
        return text.toString();
    }

    private String buildHtml(AppUser user, String temporaryPassword) {
        String firstName = firstName(user.getFullName());
        return "<!doctype html>"
                + "<html><body style=\"margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">"
                + "<div style=\"max-width:680px;margin:0 auto;padding:32px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.10);\">"
                + "<div style=\"background:#111827;padding:28px 34px;color:#ffffff;\">"
                + "<div style=\"font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c7d2fe;\">Gestion Planning Sage</div>"
                + "<h1 style=\"margin:10px 0 0;font-size:26px;line-height:1.25;font-weight:700;\">Bienvenue, " + escape(firstName) + "</h1>"
                + "<p style=\"margin:10px 0 0;color:#d1d5db;font-size:15px;line-height:1.6;\">Votre compte a été créé avec succès. Voici vos coordonnées d'accès.</p>"
                + "</div>"
                + "<div style=\"padding:30px 34px;\">"
                + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.7;\">Bonjour <strong>" + escape(user.getFullName()) + "</strong>, vous pouvez maintenant accéder à la plateforme Gestion Planning Sage avec les informations ci-dessous.</p>"
                + credentialsTable(user, temporaryPassword)
                + "<div style=\"text-align:center;margin:30px 0 24px;\">"
                + "<a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:700;font-size:14px;\">Accéder à mon compte</a>"
                + "</div>"
                + "<div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;color:#475569;font-size:14px;line-height:1.6;\">"
                + "<strong style=\"color:#111827;\">Conseil sécurité :</strong> changez votre mot de passe après votre première connexion et conservez ces informations dans un endroit confidentiel."
                + "</div>"
                + "</div>"
                + "<div style=\"border-top:1px solid #e5e7eb;padding:18px 34px;color:#64748b;font-size:12px;line-height:1.6;background:#fbfdff;\">"
                + "Cet email a été envoyé automatiquement par Gestion Planning Sage. Merci de ne pas y répondre directement."
                + "</div>"
                + "</div>"
                + "</div>"
                + "</body></html>";
    }

    private String credentialsTable(AppUser user, String temporaryPassword) {
        return "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-size:14px;\">"
                + credentialRow("Nom complet", user.getFullName(), true)
                + credentialRow("Identifiant", user.getUsername(), false)
                + credentialRow("Email", user.getEmail(), true)
                + credentialRow("Mot de passe", temporaryPassword, false)
                + credentialRow("Rôle", user.getRole(), true)
                + credentialRow("Poste", user.getJobTitle(), false)
                + credentialRow("Téléphone", user.getPhone(), true)
                + credentialRow("Statut", user.isEnabled() ? "Actif" : "Inactif", false)
                + "</table>";
    }

    private String credentialRow(String label, Object rawValue, boolean alternate) {
        String background = alternate ? "#ffffff" : "#f8fafc";
        return "<tr style=\"background:" + background + ";\">"
                + "<td style=\"width:38%;padding:13px 16px;color:#64748b;border-bottom:1px solid #e5e7eb;\">" + escape(label) + "</td>"
                + "<td style=\"padding:13px 16px;color:#111827;border-bottom:1px solid #e5e7eb;font-weight:700;\">" + escape(value(rawValue)) + "</td>"
                + "</tr>";
    }

    private String firstName(String fullName) {
        String safeName = value(fullName);
        int spaceIndex = safeName.indexOf(' ');
        return spaceIndex > 0 ? safeName.substring(0, spaceIndex) : safeName;
    }

    private String modificationName(EcrRequest request) {
        if (request == null) {
            return "-";
        }
        if (!isBlank(request.getModificationNumber())) {
            return request.getModificationNumber();
        }
        if (!isBlank(request.getClient())) {
            return request.getClient();
        }
        if (!isBlank(request.getProduct())) {
            return request.getProduct();
        }
        return request.getId() == null ? "-" : "Modification " + request.getId();
    }

    private String value(Object value) {
        return value == null || value.toString().trim().isEmpty() ? "-" : value.toString().trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String escape(String value) {
        return value(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String escapeAttribute(String value) {
        return escape(value).replace("\n", "");
    }
}

