package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class WeeklyModificationProgressMailService {
    private static final Logger LOGGER = LoggerFactory.getLogger(WeeklyModificationProgressMailService.class);

    private final EcrRequestRepository requestRepository;
    private final EcrActionRepository actionRepository;
    private final AccessControlService accessControlService;
    private final AccountMailService mailService;
    private final boolean enabled;

    public WeeklyModificationProgressMailService(EcrRequestRepository requestRepository,
                                                 EcrActionRepository actionRepository,
                                                 AccessControlService accessControlService,
                                                 AccountMailService mailService,
                                                 @Value("${app.weekly-progress-mail.enabled:true}") boolean enabled) {
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.accessControlService = accessControlService;
        this.mailService = mailService;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${app.weekly-progress-mail.cron:0 0 8 * * MON}", zone = "${app.weekly-progress-mail.zone:Africa/Tunis}")
    @Transactional(readOnly = true)
    public void sendWeeklyProgressEmails() {
        if (!enabled) {
            return;
        }
        requestRepository.findByArchivedFalseOrderByReceptionDateDescIdDesc().stream()
                .filter(this::isActiveModification)
                .forEach(this::sendProgressEmail);
    }

    private void sendProgressEmail(EcrRequest request) {
        List<EcrAction> actions = actionRepository.findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(request.getId());
        Map<String, AppUser> recipients = new LinkedHashMap<>();
        accessControlService.adminsFor().forEach(user -> addRecipient(recipients, user));
        accessControlService.projectLeadFor(request).ifPresent(user -> addRecipient(recipients, user));
        if (recipients.isEmpty()) {
            LOGGER.warn("Weekly progress email skipped for request {} because no admin/project lead has an email.", request.getId());
            return;
        }
        try {
            byte[] excel = buildDossierExcel(request, actions);
            mailService.sendModificationProgressExcelEmail(request, recipients.values(), excel, filename(request));
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to send weekly progress email for request {}", request.getId(), exception);
        }
    }

    private byte[] buildDossierExcel(EcrRequest request, List<EcrAction> actions) {
        List<EcrAction> sortedActions = actions.stream()
                .sorted(Comparator.comparingInt((EcrAction action) -> stageIndex(request, action))
                        .thenComparingLong(action -> action.getId() == null ? 0L : action.getId()))
                .collect(Collectors.toList());
        String generatedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        long doneCount = doneCount(sortedActions);
        long lateCount = sortedActions.stream().filter(action -> "late".equals(actionGanttStatusClass(action))).count();
        long proofCount = sortedActions.stream().filter(action -> !actionProofLabel(action).isEmpty()).count();
        int completionRate = sortedActions.isEmpty() ? 0 : (int) Math.round((doneCount * 100.0) / sortedActions.size());
        StringBuilder phaseSections = new StringBuilder();
        int excelRow = 13;
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            List<EcrAction> phaseActions = sortedActions.stream()
                    .filter(action -> (action.getStage() == null ? request.getCurrentStage() : action.getStage()) == stage)
                    .collect(Collectors.toList());
            if (phaseActions.isEmpty()) {
                continue;
            }
            long phaseDone = doneCount(phaseActions);
            long phaseLate = phaseActions.stream().filter(action -> "late".equals(actionGanttStatusClass(action))).count();
            phaseSections.append("<tr class=\"phase-title\"><td class=\"phase-sage\" colspan=\"12\">")
                    .append(escapeExcelHtml(stage.getLabel(request.isNewVersion())))
                    .append(" | Actions: ").append(phaseActions.size())
                    .append(" | Done: ").append(phaseDone)
                    .append(" | Retard: ").append(phaseLate)
                    .append("</td></tr>")
                    .append("<tr class=\"header\"><th>N</th><th>Action</th><th>Pilote / Responsable</th><th>Validateur</th><th>Date debut</th><th>Date fin</th><th># Jours</th><th>Date cloture</th><th>Statut</th><th>Priorite</th><th>Preuves / documents</th><th>Commentaires</th></tr>");
            for (int index = 0; index < phaseActions.size(); index++) {
                EcrAction action = phaseActions.get(index);
                excelRow++;
                String startDate = date(firstDate(action.getStartDate(), action.getDate1()));
                String endDate = date(firstDate(action.getDeadline(), action.getEndDate(), action.getDate2()));
                String completionDate = date(action.getClosedDate());
                if ("-".equals(completionDate) && action.getFinalizationDate() != null) {
                    completionDate = action.getFinalizationDate().toLocalDate().toString();
                }
                String plannedDays = action.getWorkDurationDays() == null
                        ? (!"-".equals(startDate) && !"-".equals(endDate) ? "=F" + excelRow + "-E" + excelRow : "")
                        : String.valueOf(action.getWorkDurationDays());
                phaseSections.append("<tr class=\"action-row\">")
                        .append("<td class=\"center\">").append(index + 1).append("</td>")
                        .append("<td class=\"action\">").append(escapeExcelHtml(action.getTitle())).append("</td>")
                        .append("<td>").append(escapeExcelHtml(action.getResponsible())).append("</td>")
                        .append("<td>").append(escapeExcelHtml(firstText(action.getValidatorDisplayName(), action.getValidator()))).append("</td>")
                        .append("<td class=\"center date-cell\">").append(escapeHtml(startDate)).append("</td>")
                        .append("<td class=\"center date-cell\">").append(escapeHtml(endDate)).append("</td>")
                        .append("<td class=\"center\">").append(escapeHtml(plannedDays)).append("</td>")
                        .append("<td class=\"center date-cell\">").append(escapeHtml(completionDate)).append("</td>")
                        .append("<td class=\"").append(statusClassName(action)).append("\">").append(escapeExcelHtml(actionGanttStatusLabel(action))).append("</td>")
                        .append("<td>").append(escapeExcelHtml(priority(action))).append("</td>")
                        .append("<td class=\"proof-list\">").append(escapeExcelHtml(actionProofBulletList(action))).append("</td>")
                        .append("<td>").append(escapeExcelHtml(firstText(action.getComment(), action.getDossierReview()))).append("</td>")
                        .append("</tr>");
            }
            excelRow += 2;
        }
        if (phaseSections.length() == 0) {
            phaseSections.append("<tr><td colspan=\"12\" class=\"center\">Aucune action renseignee pour cette modification.</td></tr>");
        }

        String html = "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Dossier Excel - " + escapeHtml(requestDisplayName(request)) + "</title><style>"
                + "body{font-family:Calibri,Arial,sans-serif;color:#172008;margin:0;background:#fff}"
                + "table{border-collapse:collapse;table-layout:fixed;width:1780px}"
                + "col.c1{width:54px} col.c2{width:430px} col.c3{width:190px} col.c4{width:190px} col.c5{width:120px} col.c6{width:120px}"
                + "col.c7{width:80px} col.c8{width:120px} col.c9{width:135px} col.c10{width:105px} col.c11{width:300px} col.c12{width:340px}"
                + "td,th{border:1px solid #172008;padding:6px 8px;vertical-align:middle;font-size:10pt;line-height:1.25;white-space:normal;mso-number-format:\"\\@\";}"
                + ".title{background:#172008;color:#fff;font-size:20pt;font-weight:700;text-align:center;height:42px}"
                + ".subtitle{background:#5f7f13;color:#fff;font-size:12pt;font-weight:700;text-align:center}"
                + ".meta-label{background:#e7f0dc;font-weight:700}.meta-value{background:#fbfcf8}.metric{background:#f7f9f1;text-align:center}"
                + ".metric strong{display:block;font-size:18pt;color:#172008}.metric span{display:block;color:#5f7f13;font-size:9pt;font-weight:700;text-transform:uppercase}"
                + ".phase-title td,.phase-title{color:#000;font-size:13pt;font-weight:700;height:28px;text-align:left}.phase-sage{background:#5f7f13;color:#fff}"
                + ".header th{background:#c0b600;color:#fff;font-weight:700;text-align:center;height:28px}.action{text-align:left}.center{text-align:center}.date-cell{mso-number-format:\"dd/mm/yyyy\"}"
                + ".action-row td{height:30px}.status-done{background:#5f7f13;color:#fff;text-align:center;font-weight:700}.status-late{background:#ff0202;color:#fff;text-align:center;font-weight:700}"
                + ".status-open{background:#676267;color:#fff;text-align:center;font-weight:700}.status-cancelled{background:#ff0202;color:#fff;text-align:center;font-weight:700}"
                + ".footer-title{background:#dce8ce;font-weight:700;text-align:center}.signature{height:34px}"
                + "</style></head><body><table>"
                + "<colgroup><col class=\"c1\"><col class=\"c2\"><col class=\"c3\"><col class=\"c4\"><col class=\"c5\"><col class=\"c6\"><col class=\"c7\"><col class=\"c8\"><col class=\"c9\"><col class=\"c10\"><col class=\"c11\"><col class=\"c12\"></colgroup>"
                + "<tr><td class=\"title\" colspan=\"12\">DOSSIER EXCEL COMPLET - SAGE Automotive Interiors</td></tr>"
                + "<tr><td class=\"subtitle\" colspan=\"12\">Tableau phase par phase des actions de la modification</td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Modification</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(requestDisplayName(request)) + "</td><td class=\"meta-label\" colspan=\"2\">Statut</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(requestStatusLabel(request)) + "</td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Client</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(request.getClient()) + "</td><td class=\"meta-label\" colspan=\"2\">Projet</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(request.getModificationProject()) + "</td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Produit</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(request.getProduct()) + "</td><td class=\"meta-label\" colspan=\"2\">Produits finis</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(request.getFinishedProducts()) + "</td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Pilote modification</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(request.getPilot()) + "</td><td class=\"meta-label\" colspan=\"2\">SOP</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(date(request.getSopDate())) + "</td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Date reception</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(date(request.getReceptionDate())) + "</td><td class=\"meta-label\" colspan=\"2\">Extraction</td><td class=\"meta-value\" colspan=\"4\">" + escapeExcelHtml(generatedAt) + "</td></tr>"
                + "<tr><td class=\"metric\" colspan=\"3\"><span>Actions</span><strong>" + sortedActions.size() + "</strong></td><td class=\"metric\" colspan=\"3\"><span>Done</span><strong>" + doneCount + "</strong></td><td class=\"metric\" colspan=\"2\"><span>Retard</span><strong>" + lateCount + "</strong></td><td class=\"metric\" colspan=\"2\"><span>Preuves</span><strong>" + proofCount + "</strong></td><td class=\"metric\" colspan=\"2\"><span>Avancement</span><strong>" + completionRate + "%</strong></td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Raison</td><td class=\"meta-value\" colspan=\"10\">" + escapeExcelHtml(request.getModificationReason()) + "</td></tr>"
                + "<tr><td class=\"meta-label\" colspan=\"2\">Detail</td><td class=\"meta-value\" colspan=\"10\">" + escapeExcelHtml(request.getModificationDetail()) + "</td></tr>"
                + "<tr><td colspan=\"12\"></td></tr>"
                + phaseSections
                + "<tr><td colspan=\"12\"></td></tr><tr><td class=\"footer-title\" colspan=\"12\">Synthese SAGE ECR - " + escapeExcelHtml(requestDisplayName(request)) + "</td></tr>"
                + "<tr><td colspan=\"2\">Revue dossier</td><td colspan=\"10\">" + escapeExcelHtml(request.getDossierReview()) + "</td></tr>"
                + "<tr><td colspan=\"12\"></td></tr></table></body></html>";
        return html.getBytes(StandardCharsets.UTF_8);
    }

    private byte[] buildWorkbook(EcrRequest request, List<EcrAction> actions) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            CellStyle titleStyle = titleStyle(workbook);
            CellStyle headerStyle = headerStyle(workbook);
            CellStyle percentStyle = workbook.createCellStyle();
            percentStyle.setDataFormat(workbook.createDataFormat().getFormat("0%"));

            Sheet summary = workbook.createSheet("Dossier");
            int rowIndex = 0;
            rowIndex = summaryRow(summary, rowIndex, "Modification", value(request.getModificationNumber()), titleStyle);
            rowIndex = summaryRow(summary, rowIndex, "Projet", value(request.getModificationProject()), null);
            rowIndex = summaryRow(summary, rowIndex, "Client", value(request.getClient()), null);
            rowIndex = summaryRow(summary, rowIndex, "Produit", value(request.getProduct()), null);
            rowIndex = summaryRow(summary, rowIndex, "Chef de projet", value(request.getPilot()), null);
            rowIndex = summaryRow(summary, rowIndex, "Phase actuelle", request.getCurrentStage() == null ? "-" : request.getCurrentStage().getLabel(request.isNewVersion()), null);
            rowIndex = summaryRow(summary, rowIndex, "Statut", status(request), null);
            rowIndex = summaryRow(summary, rowIndex, "Date reception", date(request.getReceptionDate()), null);
            rowIndex = summaryRow(summary, rowIndex, "SOP", date(request.getSopDate()), null);
            rowIndex = summaryRow(summary, rowIndex, "Extraction", LocalDateTime.now().toString(), null);
            rowIndex++;
            summaryRow(summary, rowIndex++, "Actions totales", String.valueOf(actions.size()), null);
            summaryRow(summary, rowIndex++, "Actions terminees", String.valueOf(doneCount(actions)), null);
            Row completionRow = summary.createRow(rowIndex);
            completionRow.createCell(0).setCellValue("Avancement");
            Cell completionCell = completionRow.createCell(1);
            completionCell.setCellValue(actions.isEmpty() ? 0 : (double) doneCount(actions) / actions.size());
            completionCell.setCellStyle(percentStyle);
            autoSize(summary, 2);

            Sheet actionSheet = workbook.createSheet("Actions");
            createActionHeader(actionSheet, headerStyle);
            for (int index = 0; index < actions.size(); index++) {
                EcrAction action = actions.get(index);
                Row row = actionSheet.createRow(index + 1);
                write(row, 0, value(action.getTitle()));
                write(row, 1, action.getStage() == null ? "-" : action.getStage().getLabel(request.isNewVersion()));
                write(row, 2, value(action.getResponsible()));
                write(row, 3, value(action.getValidatorDisplayName()));
                write(row, 4, value(action.getStatus()));
                write(row, 5, date(action.getStartDate()));
                write(row, 6, date(action.getEndDate()));
                write(row, 7, date(action.getDeadline()));
                write(row, 8, isDone(action) ? "Terminee" : "Ouverte");
                write(row, 9, value(action.getCriticality()));
                write(row, 10, firstText(action.getEvidence(), action.getProofDocument()));
                write(row, 11, firstText(action.getComment(), action.getDossierReview()));
            }
            autoSize(actionSheet, 12);

            workbook.write(output);
            return output.toByteArray();
        }
    }

    private void createActionHeader(Sheet sheet, CellStyle headerStyle) {
        Row row = sheet.createRow(0);
        String[] headers = {"Action", "Phase", "Pilote", "Validateur", "Statut", "Debut", "Fin", "Echeance", "Avancement", "Criticite", "Preuve", "Commentaire"};
        for (int index = 0; index < headers.length; index++) {
            Cell cell = row.createCell(index);
            cell.setCellValue(headers[index]);
            cell.setCellStyle(headerStyle);
        }
    }

    private int summaryRow(Sheet sheet, int rowIndex, String label, String value, CellStyle valueStyle) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        Cell valueCell = row.createCell(1);
        valueCell.setCellValue(value);
        if (valueStyle != null) {
            valueCell.setCellStyle(valueStyle);
        }
        return rowIndex + 1;
    }

    private CellStyle titleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }

    private CellStyle headerStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private void write(Row row, int index, String value) {
        row.createCell(index).setCellValue(value);
    }

    private void autoSize(Sheet sheet, int columns) {
        for (int index = 0; index < columns; index++) {
            sheet.autoSizeColumn(index);
        }
    }

    private void addRecipient(Map<String, AppUser> recipients, AppUser user) {
        String email = user == null ? "" : value(user.getEmail()).trim().toLowerCase();
        if (!email.isEmpty() && !"-".equals(email)) {
            recipients.put(email, user);
        }
    }

    private boolean isActiveModification(EcrRequest request) {
        return request != null
                && !request.isArchived()
                && !request.isClosureStatus()
                && !request.isCancelledStatus()
                && request.getCurrentStage() != EcrStage.CLOSED
                && request.getCurrentStage() != EcrStage.CANCELLED;
    }

    private long doneCount(List<EcrAction> actions) {
        return actions.stream().filter(this::isDone).count();
    }

    private boolean isDone(EcrAction action) {
        return action != null && (action.isChecked()
                || action.getStatus() == ActionStatus.DONE
                || action.getStatus() == ActionStatus.DONE_LATE);
    }

    private int stageIndex(EcrRequest request, EcrAction action) {
        EcrStage actionStage = action == null || action.getStage() == null ? request.getCurrentStage() : action.getStage();
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int index = stages.indexOf(actionStage);
        return index < 0 ? 99 : index;
    }

    private LocalDate firstDate(LocalDate... dates) {
        if (dates == null) {
            return null;
        }
        for (LocalDate current : dates) {
            if (current != null) {
                return current;
            }
        }
        return null;
    }

    private String actionGanttStatusClass(EcrAction action) {
        if (action == null) {
            return "planned";
        }
        if (action.getStatus() == ActionStatus.CANCELLED) {
            return "cancelled";
        }
        if (isDone(action)) {
            return "closed";
        }
        LocalDate end = firstDate(action.getEndDate(), action.getDeadline());
        return end != null && end.isBefore(LocalDate.now()) ? "late" : "planned";
    }

    private String actionGanttStatusLabel(EcrAction action) {
        if (action != null && action.getStatus() == ActionStatus.CANCELLED) {
            return "Annulee";
        }
        if (isDone(action)) {
            return "Done";
        }
        return "late".equals(actionGanttStatusClass(action)) ? "En retard" : "Planifie / a faire";
    }

    private String statusClassName(EcrAction action) {
        if (action != null && action.getStatus() == ActionStatus.CANCELLED) {
            return "status-cancelled";
        }
        if (isDone(action)) {
            return "status-done";
        }
        return "late".equals(actionGanttStatusClass(action)) ? "status-late" : "status-open";
    }

    private String priority(EcrAction action) {
        String criticality = value(action == null ? null : action.getCriticality()).toLowerCase();
        if (criticality.startsWith("1") || criticality.contains("critic") || criticality.contains("high")) {
            return "Elevee";
        }
        if (criticality.startsWith("2") || criticality.contains("moy") || criticality.contains("medium")) {
            return "Moyenne";
        }
        return "Faible";
    }

    private String actionProofLabel(EcrAction action) {
        return proofItems(action).stream().collect(Collectors.joining(" / "));
    }

    private String actionProofBulletList(EcrAction action) {
        List<String> items = proofItems(action);
        return items.isEmpty() ? "-" : items.stream().map(item -> "- " + item).collect(Collectors.joining("\n"));
    }

    private List<String> proofItems(EcrAction action) {
        java.util.LinkedHashSet<String> items = new java.util.LinkedHashSet<>();
        addText(items, action == null ? null : action.getProofDocument());
        addText(items, action == null ? null : action.getProofDocumentFileName());
        if (action != null && action.getProofDocuments() != null) {
            action.getProofDocuments().forEach(document -> addText(items, document.getFileName()));
        }
        addText(items, action == null ? null : action.getExpectedEvidence());
        addText(items, action == null ? null : action.getEvidence());
        addText(items, action == null ? null : action.getEvidenceFileName());
        if (action != null && action.getAssets() != null) {
            action.getAssets().forEach(asset -> addText(items, asset.getFileName()));
        }
        return new java.util.ArrayList<>(items);
    }

    private void addText(java.util.Set<String> items, String value) {
        if (value != null && !value.trim().isEmpty()) {
            items.add(value.trim());
        }
    }

    private String requestDisplayName(EcrRequest request) {
        return firstText(request.getModificationNumber(), request.getClient(), request.getProduct(), "Modification sans reference");
    }

    private String requestStatusLabel(EcrRequest request) {
        if (request.isCancelledStatus() || request.getCurrentStage() == EcrStage.CANCELLED) {
            return "Annulee";
        }
        if (request.isClosureStatus() || request.getCurrentStage() == EcrStage.CLOSED) {
            return "Cloturee";
        }
        if (request.isClosureRequested()) {
            return "Cloture demandee";
        }
        return "Active";
    }

    private String status(EcrRequest request) {
        if (request.isClosureStatus()) {
            return "Cloturee";
        }
        if (request.isCancelledStatus()) {
            return "Annulee";
        }
        return "En cours";
    }

    private String filename(EcrRequest request) {
        return "dossier-modification-" + safeFilename(requestDisplayName(request)) + "-" + LocalDate.now() + ".xls";
    }

    private String safeFilename(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]+", "_");
    }

    private String firstText(String... values) {
        if (values == null) {
            return "-";
        }
        for (String current : values) {
            if (current != null && !current.trim().isEmpty()) {
                return current.trim();
            }
        }
        return "-";
    }

    private String date(LocalDate date) {
        return date == null ? "-" : date.toString();
    }

    private String value(Object value) {
        return value == null || value.toString().trim().isEmpty() ? "-" : value.toString().trim();
    }

    private String escapeExcelHtml(String value) {
        return escapeHtml(value).replace("\r\n", "<br>").replace("\n", "<br>").replace("\r", "<br>");
    }

    private String escapeHtml(Object value) {
        return value(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
