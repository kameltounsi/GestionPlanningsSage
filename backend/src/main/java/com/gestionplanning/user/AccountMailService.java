package com.gestionplanning.user;

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
import javax.mail.internet.MimeMessage;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMultipart;
import java.util.Properties;

@Service
public class AccountMailService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AccountMailService.class);

    private final String host;
    private final int port;
    private final String fromAddress;
    private final String password;
    private final boolean smtpAuth;
    private final boolean startTlsEnabled;
    private final boolean startTlsRequired;
    private final String applicationUrl;
    private final boolean mailEnabled;

    public AccountMailService(@Value("${spring.mail.host:smtp.gmail.com}") String host,
                              @Value("${spring.mail.port:587}") int port,
                              @Value("${spring.mail.username:}") String fromAddress,
                              @Value("${spring.mail.password:}") String password,
                              @Value("${spring.mail.properties.mail.smtp.auth:true}") boolean smtpAuth,
                              @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}") boolean startTlsEnabled,
                              @Value("${spring.mail.properties.mail.smtp.starttls.required:true}") boolean startTlsRequired,
                              @Value("${app.frontend.url:http://localhost:5173}") String applicationUrl,
                              @Value("${app.account.mail.enabled:true}") boolean mailEnabled) {
        this.host = host;
        this.port = port;
        this.fromAddress = fromAddress;
        this.password = password;
        this.smtpAuth = smtpAuth;
        this.startTlsEnabled = startTlsEnabled;
        this.startTlsRequired = startTlsRequired;
        this.applicationUrl = applicationUrl;
        this.mailEnabled = mailEnabled;
    }

    public void sendAccountCreatedEmail(AppUser user, String temporaryPassword) {
        if (!mailEnabled) {
            return;
        }
        if (user == null || isBlank(user.getEmail())) {
            LOGGER.warn("Account creation email skipped because recipient email is missing.");
            return;
        }

        try {
            MimeMessage message = new MimeMessage(mailSession());
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(user.getEmail()));
            message.setFrom(new InternetAddress(fromAddress));
            message.setSubject("Vos acces Gestion Planning Sage", "UTF-8");
            message.setContent(buildContent(user, temporaryPassword));
            Transport.send(message);
        } catch (MessagingException | RuntimeException exception) {
            LOGGER.error("Unable to send account creation email to {}", user.getEmail(), exception);
        }
    }

    private Session mailSession() {
        Properties properties = new Properties();
        properties.put("mail.smtp.host", host);
        properties.put("mail.smtp.port", String.valueOf(port));
        properties.put("mail.smtp.auth", String.valueOf(smtpAuth));
        properties.put("mail.smtp.starttls.enable", String.valueOf(startTlsEnabled));
        properties.put("mail.smtp.starttls.required", String.valueOf(startTlsRequired));

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

    private MimeMultipart buildContent(AppUser user, String temporaryPassword) throws MessagingException {
        MimeMultipart content = new MimeMultipart("alternative");

        MimeBodyPart plainText = new MimeBodyPart();
        plainText.setText(buildPlainText(user, temporaryPassword), "UTF-8");
        content.addBodyPart(plainText);

        MimeBodyPart html = new MimeBodyPart();
        html.setContent(buildHtml(user, temporaryPassword), "text/html; charset=UTF-8");
        content.addBodyPart(html);

        return content;
    }

    private String buildPlainText(AppUser user, String temporaryPassword) {
        StringBuilder text = new StringBuilder();
        text.append("Bonjour ").append(value(user.getFullName())).append(",\n\n");
        text.append("Votre compte Gestion Planning Sage a ete cree.\n\n");
        text.append("Lien d'acces: ").append(value(applicationUrl)).append("\n");
        text.append("Nom complet: ").append(value(user.getFullName())).append("\n");
        text.append("Identifiant: ").append(value(user.getUsername())).append("\n");
        text.append("Email: ").append(value(user.getEmail())).append("\n");
        text.append("Mot de passe: ").append(value(temporaryPassword)).append("\n");
        text.append("Role: ").append(value(user.getRole())).append("\n");
        text.append("Poste: ").append(value(user.getJobTitle())).append("\n");
        text.append("Telephone: ").append(value(user.getPhone())).append("\n");
        text.append("Statut: ").append(user.isEnabled() ? "Actif" : "Inactif").append("\n\n");
        text.append("Pour votre securite, changez votre mot de passe apres la premiere connexion.\n");
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
                + "<p style=\"margin:10px 0 0;color:#d1d5db;font-size:15px;line-height:1.6;\">Votre compte a ete cree avec succes. Voici vos coordonnees d'acces.</p>"
                + "</div>"
                + "<div style=\"padding:30px 34px;\">"
                + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.7;\">Bonjour <strong>" + escape(user.getFullName()) + "</strong>, vous pouvez maintenant acceder a la plateforme Gestion Planning Sage avec les informations ci-dessous.</p>"
                + credentialsTable(user, temporaryPassword)
                + "<div style=\"text-align:center;margin:30px 0 24px;\">"
                + "<a href=\"" + escapeAttribute(applicationUrl) + "\" style=\"display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:700;font-size:14px;\">Acceder a mon compte</a>"
                + "</div>"
                + "<div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;color:#475569;font-size:14px;line-height:1.6;\">"
                + "<strong style=\"color:#111827;\">Conseil securite :</strong> changez votre mot de passe apres votre premiere connexion et conservez ces informations dans un endroit confidentiel."
                + "</div>"
                + "</div>"
                + "<div style=\"border-top:1px solid #e5e7eb;padding:18px 34px;color:#64748b;font-size:12px;line-height:1.6;background:#fbfdff;\">"
                + "Cet email a ete envoye automatiquement par Gestion Planning Sage. Merci de ne pas y repondre directement."
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
                + credentialRow("Role", user.getRole(), true)
                + credentialRow("Poste", user.getJobTitle(), false)
                + credentialRow("Telephone", user.getPhone(), true)
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
