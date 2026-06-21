package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.user.AppUser;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/preferentials/finished-products")
public class FinishedProductReferenceController {
    private final FinishedProductReferenceRepository repository;
    private final ClientReferenceRepository clientRepository;
    private final ProjectReferenceRepository projectRepository;
    private final ProductReferenceRepository productRepository;
    private final AuditLogService auditLogService;

    public FinishedProductReferenceController(FinishedProductReferenceRepository repository,
                                              ClientReferenceRepository clientRepository,
                                              ProjectReferenceRepository projectRepository,
                                              ProductReferenceRepository productRepository,
                                              AuditLogService auditLogService) {
        this.repository = repository;
        this.clientRepository = clientRepository;
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<FinishedProductReference> list() {
        return repository.findAllByOrderByProjectAscProductAscPartNumberAsc();
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FinishedProductImportResult> importFile(@RequestParam("file") MultipartFile file,
                                                                  @RequestAttribute("authenticatedUser") AppUser user) {
        FinishedProductImportResult result = new FinishedProductImportResult();
        if (file == null || file.isEmpty()) {
            result.addError(0, "Le fichier Excel est vide.");
            return ResponseEntity.badRequest().body(result);
        }

        try (InputStream inputStream = file.getInputStream(); Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                result.addError(0, "Le fichier ne contient aucune feuille.");
                return ResponseEntity.badRequest().body(result);
            }
            importSheet(sheet, result);
        } catch (IOException | RuntimeException exception) {
            result.addError(0, "Lecture Excel impossible. Verifiez que le fichier est bien au format .xlsx.");
            return ResponseEntity.badRequest().body(result);
        }

        if (result.getCreatedCount() > 0) {
            auditLogService.recordBusinessEvent(user, "IMPORT_PRODUITS_FINIS", "produit_fini", null,
                    "Import Excel produits finis: " + result.getCreatedCount() + " ajoute(s), " + result.getSkippedCount() + " ignore(s).");
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody FinishedProductReference finishedProduct,
                                    @RequestAttribute("authenticatedUser") AppUser user) {
        normalize(finishedProduct);
        if (!linkedReferencesExist(finishedProduct)) {
            return ResponseEntity.badRequest().build();
        }
        String uniquenessError = uniquenessError(finishedProduct, null);
        if (uniquenessError != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(uniquenessError);
        }
        FinishedProductReference saved;
        try {
            saved = repository.save(finishedProduct);
        } catch (DataIntegrityViolationException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Part number ou code réduit déjà existant.");
        }
        auditLogService.recordBusinessEvent(user, "AJOUT_PRODUIT_FINI", "produit_fini", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du produit fini: " + saved.getPartNumber());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @Valid @RequestBody FinishedProductReference updatedFinishedProduct) {
        normalize(updatedFinishedProduct);
        if (!linkedReferencesExist(updatedFinishedProduct)) {
            return ResponseEntity.badRequest().build();
        }
        String uniquenessError = uniquenessError(updatedFinishedProduct, id);
        if (uniquenessError != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(uniquenessError);
        }
        return repository.findById(id)
                .map(finishedProduct -> {
                    finishedProduct.setClient(updatedFinishedProduct.getClient());
                    finishedProduct.setProject(updatedFinishedProduct.getProject());
                    finishedProduct.setPartNumber(updatedFinishedProduct.getPartNumber());
                    finishedProduct.setDesignation(trimToNull(updatedFinishedProduct.getDesignation()));
                    finishedProduct.setCustomerPn(trimToNull(updatedFinishedProduct.getCustomerPn()));
                    finishedProduct.setProduct(updatedFinishedProduct.getProduct());
                    finishedProduct.setCoiffeIndex(trimToNull(updatedFinishedProduct.getCoiffeIndex()));
                    finishedProduct.setDrawingIndex(trimToNull(updatedFinishedProduct.getDrawingIndex()));
                    finishedProduct.setReducedCode(updatedFinishedProduct.getReducedCode());
                    finishedProduct.setSalePrice(updatedFinishedProduct.getSalePrice());
                    finishedProduct.setProductionIntegrationDate(updatedFinishedProduct.getProductionIntegrationDate());
                    finishedProduct.setComments(trimToNull(updatedFinishedProduct.getComments()));
                    try {
                        return ResponseEntity.ok(repository.save(finishedProduct));
                    } catch (DataIntegrityViolationException exception) {
                        return ResponseEntity.status(HttpStatus.CONFLICT).body("Part number ou code réduit déjà existant.");
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void normalize(FinishedProductReference finishedProduct) {
        finishedProduct.setClient(finishedProduct.getClient().trim());
        finishedProduct.setProject(finishedProduct.getProject().trim());
        finishedProduct.setPartNumber(finishedProduct.getPartNumber().trim());
        finishedProduct.setDesignation(trimToNull(finishedProduct.getDesignation()));
        finishedProduct.setCustomerPn(trimToNull(finishedProduct.getCustomerPn()));
        finishedProduct.setProduct(finishedProduct.getProduct().trim());
        finishedProduct.setCoiffeIndex(trimToNull(finishedProduct.getCoiffeIndex()));
        finishedProduct.setDrawingIndex(trimToNull(finishedProduct.getDrawingIndex()));
        finishedProduct.setReducedCode(finishedProduct.getReducedCode().trim());
        finishedProduct.setComments(trimToNull(finishedProduct.getComments()));
    }

    private boolean linkedReferencesExist(FinishedProductReference finishedProduct) {
        return clientRepository.existsByName(finishedProduct.getClient())
                && projectRepository.existsById(finishedProduct.getProject())
                && productRepository.existsByName(finishedProduct.getProduct());
    }

    private String uniquenessError(FinishedProductReference finishedProduct, Long currentId) {
        boolean partNumberExists = currentId == null
                ? repository.existsByPartNumber(finishedProduct.getPartNumber())
                : repository.existsByPartNumberAndIdNot(finishedProduct.getPartNumber(), currentId);
        if (partNumberExists) {
            return "Ce part number existe déjà.";
        }
        boolean reducedCodeExists = currentId == null
                ? repository.existsByReducedCode(finishedProduct.getReducedCode())
                : repository.existsByReducedCodeAndIdNot(finishedProduct.getReducedCode(), currentId);
        if (reducedCodeExists) {
            return "Ce code réduit existe déjà.";
        }
        return null;
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private void importSheet(Sheet sheet, FinishedProductImportResult result) {
        Row headerRow = sheet.getRow(sheet.getFirstRowNum());
        if (headerRow == null) {
            result.addError(0, "La premiere ligne doit contenir les entetes.");
            return;
        }

        Map<String, Integer> columns = headerColumns(headerRow);
        Integer clientColumn = findColumn(columns, "client");
        Integer projectColumn = findColumn(columns, "project", "projet");
        Integer partNumberColumn = findColumn(columns, "partnumber", "partnumberinterne", "pninterne", "reference", "referenceinterne");
        Integer designationColumn = findColumn(columns, "designation", "description");
        Integer customerPnColumn = findColumn(columns, "customerpn", "pnclient", "referenceclient");
        Integer productColumn = findColumn(columns, "product", "produit");
        Integer coiffeIndexColumn = findColumn(columns, "coiffeindex", "indicecoiffe");
        Integer drawingIndexColumn = findColumn(columns, "drawingindex", "indicedrawing", "indicedessin");
        Integer reducedCodeColumn = findColumn(columns, "reducedcode", "codereduit");
        Integer salePriceColumn = findColumn(columns, "saleprice", "prixvente", "prix");
        Integer productionDateColumn = findColumn(columns, "productionintegrationdate", "dateintegrationproduction");
        Integer commentsColumn = findColumn(columns, "comments", "commentaires", "commentaire");

        if (clientColumn == null || projectColumn == null || partNumberColumn == null || productColumn == null || reducedCodeColumn == null) {
            result.addError(1, "Entetes obligatoires manquantes: client, project/projet, partNumber, product/produit, reducedCode.");
            return;
        }

        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        Map<String, String> clients = clientNameByKey();
        Map<String, String> projects = projectNameByKey();
        Map<String, String> products = productNameByKey();
        Set<String> existingPartNumbers = new HashSet<>();
        Set<String> existingReducedCodes = new HashSet<>();
        for (FinishedProductReference reference : repository.findAll()) {
            existingPartNumbers.add(normalizedKey(reference.getPartNumber()));
            existingReducedCodes.add(normalizedKey(reference.getReducedCode()));
        }
        Set<String> filePartNumbers = new HashSet<>();
        Set<String> fileReducedCodes = new HashSet<>();

        for (int rowIndex = sheet.getFirstRowNum() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (isBlankRow(row, formatter)) {
                continue;
            }
            int excelRow = rowIndex + 1;
            String clientInput = cellText(row, clientColumn, formatter);
            String projectInput = cellText(row, projectColumn, formatter);
            String partNumber = cellText(row, partNumberColumn, formatter);
            String productInput = cellText(row, productColumn, formatter);
            String reducedCode = cellText(row, reducedCodeColumn, formatter);

            List<String> rowErrors = new ArrayList<>();
            String client = resolveReference("client", clientInput, clients, rowErrors);
            String project = resolveReference("projet", projectInput, projects, rowErrors);
            String product = resolveReference("produit", productInput, products, rowErrors);
            if (partNumber == null) {
                rowErrors.add("partNumber obligatoire");
            }
            if (reducedCode == null) {
                rowErrors.add("reducedCode/code reduit obligatoire");
            }

            String partNumberKey = normalizedKey(partNumber);
            String reducedCodeKey = normalizedKey(reducedCode);
            if (partNumberKey != null && existingPartNumbers.contains(partNumberKey)) {
                rowErrors.add("partNumber deja existant");
            }
            if (partNumberKey != null && filePartNumbers.contains(partNumberKey)) {
                rowErrors.add("partNumber duplique dans le fichier");
            }
            if (reducedCodeKey != null && existingReducedCodes.contains(reducedCodeKey)) {
                rowErrors.add("code reduit deja existant");
            }
            if (reducedCodeKey != null && fileReducedCodes.contains(reducedCodeKey)) {
                rowErrors.add("code reduit duplique dans le fichier");
            }

            BigDecimal salePrice = parseAmount(row, salePriceColumn, formatter, rowErrors);
            LocalDate productionDate = parseDate(row, productionDateColumn, formatter, rowErrors);
            if (!rowErrors.isEmpty()) {
                result.skip(excelRow, String.join("; ", rowErrors));
                continue;
            }

            FinishedProductReference finishedProduct = new FinishedProductReference();
            finishedProduct.setClient(client);
            finishedProduct.setProject(project);
            finishedProduct.setPartNumber(partNumber);
            finishedProduct.setDesignation(cellText(row, designationColumn, formatter));
            finishedProduct.setCustomerPn(cellText(row, customerPnColumn, formatter));
            finishedProduct.setProduct(product);
            finishedProduct.setCoiffeIndex(cellText(row, coiffeIndexColumn, formatter));
            finishedProduct.setDrawingIndex(cellText(row, drawingIndexColumn, formatter));
            finishedProduct.setReducedCode(reducedCode);
            finishedProduct.setSalePrice(salePrice);
            finishedProduct.setProductionIntegrationDate(productionDate);
            finishedProduct.setComments(cellText(row, commentsColumn, formatter));
            normalize(finishedProduct);

            try {
                FinishedProductReference saved = repository.save(finishedProduct);
                result.created(saved);
                existingPartNumbers.add(partNumberKey);
                existingReducedCodes.add(reducedCodeKey);
                filePartNumbers.add(partNumberKey);
                fileReducedCodes.add(reducedCodeKey);
            } catch (DataIntegrityViolationException exception) {
                result.skip(excelRow, "partNumber ou code reduit deja existant");
            }
        }
    }

    private Map<String, Integer> headerColumns(Row headerRow) {
        Map<String, Integer> columns = new HashMap<>();
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        for (Cell cell : headerRow) {
            String header = normalizeHeader(formatter.formatCellValue(cell));
            if (header != null) {
                columns.put(header, cell.getColumnIndex());
            }
        }
        return columns;
    }

    private Integer findColumn(Map<String, Integer> columns, String... aliases) {
        for (String alias : aliases) {
            Integer column = columns.get(normalizeHeader(alias));
            if (column != null) {
                return column;
            }
        }
        return null;
    }

    private Map<String, String> clientNameByKey() {
        Map<String, String> values = new HashMap<>();
        clientRepository.findAll().forEach(client -> values.put(normalizedKey(client.getName()), client.getName()));
        return values;
    }

    private Map<String, String> projectNameByKey() {
        Map<String, String> values = new HashMap<>();
        for (ProjectReference project : projectRepository.findAll()) {
            values.put(normalizedKey(project.getName()), project.getName());
        }
        return values;
    }

    private Map<String, String> productNameByKey() {
        Map<String, String> values = new HashMap<>();
        productRepository.findAll().forEach(product -> values.put(normalizedKey(product.getName()), product.getName()));
        return values;
    }

    private String resolveReference(String label, String value, Map<String, String> existingValues, List<String> rowErrors) {
        String key = normalizedKey(value);
        if (key == null) {
            rowErrors.add(label + " obligatoire");
            return null;
        }
        String officialValue = existingValues.get(key);
        if (officialValue == null) {
            rowErrors.add(label + " inexistant: " + value);
        }
        return officialValue;
    }

    private String cellText(Row row, Integer columnIndex, DataFormatter formatter) {
        if (row == null || columnIndex == null) {
            return null;
        }
        Cell cell = row.getCell(columnIndex);
        if (cell == null) {
            return null;
        }
        String value = formatter.formatCellValue(cell);
        return trimToNull(value);
    }

    private BigDecimal parseAmount(Row row, Integer columnIndex, DataFormatter formatter, List<String> rowErrors) {
        String value = cellText(row, columnIndex, formatter);
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value.replace(" ", "").replace(",", "."));
        } catch (NumberFormatException exception) {
            rowErrors.add("prix vente invalide: " + value);
            return null;
        }
    }

    private LocalDate parseDate(Row row, Integer columnIndex, DataFormatter formatter, List<String> rowErrors) {
        if (row == null || columnIndex == null) {
            return null;
        }
        Cell cell = row.getCell(columnIndex);
        if (cell == null) {
            return null;
        }
        if (DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        String value = cellText(row, columnIndex, formatter);
        if (value == null) {
            return null;
        }
        DateTimeFormatter[] formatters = {
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("d/M/yyyy"),
                DateTimeFormatter.ofPattern("d-M-yyyy")
        };
        for (DateTimeFormatter dateFormatter : formatters) {
            try {
                return LocalDate.parse(value, dateFormatter);
            } catch (DateTimeParseException ignored) {
            }
        }
        rowErrors.add("date integration production invalide: " + value);
        return null;
    }

    private boolean isBlankRow(Row row, DataFormatter formatter) {
        if (row == null) {
            return true;
        }
        for (Cell cell : row) {
            if (trimToNull(formatter.formatCellValue(cell)) != null) {
                return false;
            }
        }
        return true;
    }

    private String normalizedKey(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }

    private String normalizeHeader(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        String withoutAccent = Normalizer.normalize(trimmed, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return withoutAccent.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    public static class FinishedProductImportResult {
        private int createdCount;
        private int skippedCount;
        private final List<FinishedProductReference> createdProducts = new ArrayList<>();
        private final List<FinishedProductImportIssue> issues = new ArrayList<>();

        public int getCreatedCount() {
            return createdCount;
        }

        public int getSkippedCount() {
            return skippedCount;
        }

        public List<FinishedProductReference> getCreatedProducts() {
            return createdProducts;
        }

        public List<FinishedProductImportIssue> getIssues() {
            return issues;
        }

        public void created(FinishedProductReference product) {
            createdCount++;
            createdProducts.add(product);
        }

        public void skip(int rowNumber, String message) {
            skippedCount++;
            issues.add(new FinishedProductImportIssue(rowNumber, message));
        }

        public void addError(int rowNumber, String message) {
            issues.add(new FinishedProductImportIssue(rowNumber, message));
        }
    }

    public static class FinishedProductImportIssue {
        private final int rowNumber;
        private final String message;

        public FinishedProductImportIssue(int rowNumber, String message) {
            this.rowNumber = rowNumber;
            this.message = message;
        }

        public int getRowNumber() {
            return rowNumber;
        }

        public String getMessage() {
            return message;
        }
    }
}
