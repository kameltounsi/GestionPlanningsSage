package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/preferentials/finished-products")
public class FinishedProductReferenceController {
    private final FinishedProductReferenceRepository repository;
    private final ClientReferenceRepository clientRepository;
    private final ProjectReferenceRepository projectRepository;
    private final ProductReferenceRepository productRepository;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;

    public FinishedProductReferenceController(FinishedProductReferenceRepository repository,
                                              ClientReferenceRepository clientRepository,
                                              ProjectReferenceRepository projectRepository,
                                              ProductReferenceRepository productRepository,
                                              AuditLogService auditLogService,
                                              AccessControlService accessControlService) {
        this.repository = repository;
        this.clientRepository = clientRepository;
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<FinishedProductReferenceDto> list() {
        return repository.findAllByOrderByProjectAscProductAscPartNumberAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FinishedProductImportResult> importFile(@RequestParam("file") MultipartFile file,
                                                                  @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                                      AppUser user = (AppUser) userAttribute;
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
            importSheet(sheet, result, user);
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
    public ResponseEntity<Object> create(@Valid @RequestBody FinishedProductReferenceDto finishedProduct,
                                    @RequestAttribute("authenticatedUser") Object userAttribute) {
                                        AppUser user = (AppUser) userAttribute;
        FinishedProductReference entity = toEntity(finishedProduct);
        normalize(entity);
        if (!accessControlService.canManageFinishedProduct(user, entity.getProject())) {
            return ResponseEntity.status(403).build();
        }
        if (!linkedReferencesExist(entity)) {
            return ResponseEntity.badRequest().build();
        }
        String uniquenessError = uniquenessError(entity, null);
        if (uniquenessError != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(uniquenessError);
        }
        FinishedProductReference saved;
        try {
            saved = repository.save(entity);
        } catch (DataIntegrityViolationException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Part number ou code réduit déjà existant.");
        }
        auditLogService.recordBusinessEvent(user, "AJOUT_PRODUIT_FINI", "produit_fini", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du produit fini: " + saved.getPartNumber());
        return ResponseEntity.ok(toDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Object> update(@PathVariable Long id,
                                    @Valid @RequestBody FinishedProductReferenceDto updatedFinishedProduct,
                                    @RequestAttribute("authenticatedUser") Object userAttribute) {
                                        AppUser user = (AppUser) userAttribute;
        FinishedProductReference updatedEntity = toEntity(updatedFinishedProduct);
        normalize(updatedEntity);
        if (!accessControlService.canManageFinishedProduct(user, updatedEntity.getProject())) {
            return ResponseEntity.status(403).build();
        }
        if (!linkedReferencesExist(updatedEntity)) {
            return ResponseEntity.badRequest().build();
        }
        String uniquenessError = uniquenessError(updatedEntity, id);
        if (uniquenessError != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(uniquenessError);
        }
        return repository.findById(id)
                .<ResponseEntity<Object>>map(finishedProduct -> {
                    copyInto(updatedEntity, finishedProduct);
                    try {
                        return ResponseEntity.ok((Object) toDto(repository.save(finishedProduct)));
                    } catch (DataIntegrityViolationException exception) {
                        return ResponseEntity.status(HttpStatus.CONFLICT).body("Part number ou code réduit déjà existant.");
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        return repository.findById(id)
                .map(reference -> {
                    if (!accessControlService.canManageFinishedProduct(user, reference.getProject())) {
                        return ResponseEntity.status(403).<Void>build();
                    }
                    repository.delete(reference);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private void normalize(FinishedProductReference finishedProduct) {
        finishedProduct.setClient(finishedProduct.getClient().trim());
        finishedProduct.setProject(finishedProduct.getProject().trim());
        finishedProduct.setPartNumber(finishedProduct.getPartNumber().trim());
        finishedProduct.setDesignation(trimToNull(finishedProduct.getDesignation()));
        finishedProduct.setCustomerPn(trimToNull(finishedProduct.getCustomerPn()));
        finishedProduct.setProduct(normalizeProductList(finishedProduct.getProduct()));
        finishedProduct.setCoiffeIndex(trimToNull(finishedProduct.getCoiffeIndex()));
        finishedProduct.setDrawingIndex(trimToNull(finishedProduct.getDrawingIndex()));
        finishedProduct.setReducedCode(finishedProduct.getReducedCode().trim());
        finishedProduct.setComments(trimToNull(finishedProduct.getComments()));
    }

    private boolean linkedReferencesExist(FinishedProductReference finishedProduct) {
        return clientRepository.existsByName(finishedProduct.getClient())
                && projectRepository.existsById(finishedProduct.getProject())
                && productsExist(finishedProduct.getProduct());
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

    private FinishedProductReference toEntity(FinishedProductReferenceDto dto) {
        FinishedProductReference entity = new FinishedProductReference();
        entity.setClient(dto.getClient());
        entity.setProject(dto.getProject());
        entity.setPartNumber(dto.getPartNumber());
        entity.setDesignation(dto.getDesignation());
        entity.setCustomerPn(dto.getCustomerPn());
        entity.setProduct(dto.getProduct());
        entity.setCoiffeIndex(dto.getCoiffeIndex());
        entity.setDrawingIndex(dto.getDrawingIndex());
        entity.setReducedCode(dto.getReducedCode());
        entity.setSalePrice(dto.getSalePrice());
        entity.setProductionIntegrationDate(dto.getProductionIntegrationDate());
        entity.setComments(dto.getComments());
        return entity;
    }

    private FinishedProductReferenceDto toDto(FinishedProductReference entity) {
        FinishedProductReferenceDto dto = new FinishedProductReferenceDto();
        dto.setId(entity.getId());
        dto.setClient(entity.getClient());
        dto.setProject(entity.getProject());
        dto.setPartNumber(entity.getPartNumber());
        dto.setDesignation(entity.getDesignation());
        dto.setCustomerPn(entity.getCustomerPn());
        dto.setProduct(entity.getProduct());
        dto.setCoiffeIndex(entity.getCoiffeIndex());
        dto.setDrawingIndex(entity.getDrawingIndex());
        dto.setReducedCode(entity.getReducedCode());
        dto.setSalePrice(entity.getSalePrice());
        dto.setProductionIntegrationDate(entity.getProductionIntegrationDate());
        dto.setComments(entity.getComments());
        return dto;
    }

    private void copyInto(FinishedProductReference source, FinishedProductReference target) {
        target.setClient(source.getClient());
        target.setProject(source.getProject());
        target.setPartNumber(source.getPartNumber());
        target.setDesignation(trimToNull(source.getDesignation()));
        target.setCustomerPn(trimToNull(source.getCustomerPn()));
        target.setProduct(source.getProduct());
        target.setCoiffeIndex(trimToNull(source.getCoiffeIndex()));
        target.setDrawingIndex(trimToNull(source.getDrawingIndex()));
        target.setReducedCode(source.getReducedCode());
        target.setSalePrice(source.getSalePrice());
        target.setProductionIntegrationDate(source.getProductionIntegrationDate());
        target.setComments(trimToNull(source.getComments()));
    }

    private void importSheet(Sheet sheet, FinishedProductImportResult result, AppUser user) {
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
            if (!isBlankRow(row, formatter)) {
                importRow(row, rowIndex + 1, formatter, result, user, clients, projects, products,
                        existingPartNumbers, existingReducedCodes, filePartNumbers, fileReducedCodes,
                        clientColumn, projectColumn, partNumberColumn, productColumn, reducedCodeColumn,
                        designationColumn, customerPnColumn, coiffeIndexColumn, drawingIndexColumn,
                        salePriceColumn, productionDateColumn, commentsColumn);
            }
        }
    }

    @SuppressWarnings("java:S107")
    private void importRow(Row row, int excelRow, DataFormatter formatter, FinishedProductImportResult result, AppUser user,
                           Map<String, String> clients, Map<String, String> projects, Map<String, String> products,
                           Set<String> existingPartNumbers, Set<String> existingReducedCodes,
                           Set<String> filePartNumbers, Set<String> fileReducedCodes,
                           Integer clientColumn, Integer projectColumn, Integer partNumberColumn, Integer productColumn,
                           Integer reducedCodeColumn, Integer designationColumn, Integer customerPnColumn,
                           Integer coiffeIndexColumn, Integer drawingIndexColumn, Integer salePriceColumn,
                           Integer productionDateColumn, Integer commentsColumn) {
        List<String> rowErrors = new ArrayList<>();
        String client = resolveReference("client", cellText(row, clientColumn, formatter), clients, rowErrors);
        String project = resolveReference("projet", cellText(row, projectColumn, formatter), projects, rowErrors);
        String partNumber = cellText(row, partNumberColumn, formatter);
        String product = resolveProductReferences(cellText(row, productColumn, formatter), products, rowErrors);
        String reducedCode = cellText(row, reducedCodeColumn, formatter);
        validateImportKeys(partNumber, reducedCode, existingPartNumbers, existingReducedCodes, filePartNumbers, fileReducedCodes, rowErrors);

        BigDecimal salePrice = parseAmount(row, salePriceColumn, formatter, rowErrors);
        LocalDate productionDate = parseDate(row, productionDateColumn, formatter, rowErrors);
        if (!rowErrors.isEmpty()) {
            result.skip(excelRow, String.join("; ", rowErrors));
            return;
        }

        FinishedProductReference finishedProduct = finishedProductFromRow(row, formatter, client, project, partNumber, product,
                reducedCode, salePrice, productionDate, designationColumn, customerPnColumn, coiffeIndexColumn,
                drawingIndexColumn, commentsColumn);
        if (!accessControlService.canManageFinishedProduct(user, finishedProduct.getProject())) {
            result.skip(excelRow, "Vous n'avez pas les droits pour gerer le projet " + finishedProduct.getProject());
            return;
        }
        saveImportedProduct(finishedProduct, result, excelRow, existingPartNumbers, existingReducedCodes, filePartNumbers, fileReducedCodes);
    }

    private void validateImportKeys(String partNumber, String reducedCode, Set<String> existingPartNumbers,
                                    Set<String> existingReducedCodes, Set<String> filePartNumbers,
                                    Set<String> fileReducedCodes, List<String> rowErrors) {
        addMissingAndDuplicateErrors(partNumber, "partNumber obligatoire", "partNumber deja existant",
                "partNumber duplique dans le fichier", existingPartNumbers, filePartNumbers, rowErrors);
        addMissingAndDuplicateErrors(reducedCode, "reducedCode/code reduit obligatoire", "code reduit deja existant",
                "code reduit duplique dans le fichier", existingReducedCodes, fileReducedCodes, rowErrors);
    }

    private void addMissingAndDuplicateErrors(String value, String missingMessage, String existingMessage, String fileMessage,
                                              Set<String> existingValues, Set<String> fileValues, List<String> rowErrors) {
        String key = normalizedKey(value);
        if (value == null) {
            rowErrors.add(missingMessage);
        }
        if (key != null && existingValues.contains(key)) {
            rowErrors.add(existingMessage);
        }
        if (key != null && fileValues.contains(key)) {
            rowErrors.add(fileMessage);
        }
    }

    @SuppressWarnings("java:S107")
    private FinishedProductReference finishedProductFromRow(Row row, DataFormatter formatter, String client, String project,
                                                            String partNumber, String product, String reducedCode,
                                                            BigDecimal salePrice, LocalDate productionDate,
                                                            Integer designationColumn, Integer customerPnColumn,
                                                            Integer coiffeIndexColumn, Integer drawingIndexColumn,
                                                            Integer commentsColumn) {
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
        return finishedProduct;
    }

    private void saveImportedProduct(FinishedProductReference finishedProduct, FinishedProductImportResult result, int excelRow,
                                     Set<String> existingPartNumbers, Set<String> existingReducedCodes,
                                     Set<String> filePartNumbers, Set<String> fileReducedCodes) {
        try {
            FinishedProductReference saved = repository.save(finishedProduct);
            result.created(saved);
            addImportKeys(saved, existingPartNumbers, existingReducedCodes, filePartNumbers, fileReducedCodes);
        } catch (DataIntegrityViolationException exception) {
            result.skip(excelRow, "partNumber ou code reduit deja existant");
        }
    }

    private void addImportKeys(FinishedProductReference finishedProduct, Set<String> existingPartNumbers,
                               Set<String> existingReducedCodes, Set<String> filePartNumbers, Set<String> fileReducedCodes) {
        String partNumberKey = normalizedKey(finishedProduct.getPartNumber());
        String reducedCodeKey = normalizedKey(finishedProduct.getReducedCode());
        existingPartNumbers.add(partNumberKey);
        existingReducedCodes.add(reducedCodeKey);
        filePartNumbers.add(partNumberKey);
        fileReducedCodes.add(reducedCodeKey);
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

    private String resolveProductReferences(String value, Map<String, String> products, List<String> rowErrors) {
        List<String> productNames = productList(value);
        if (productNames.isEmpty()) {
            rowErrors.add("produit obligatoire");
            return null;
        }
        List<String> officialProducts = new ArrayList<>();
        for (String productName : productNames) {
            String officialValue = products.get(normalizedKey(productName));
            if (officialValue == null) {
                rowErrors.add("produit inexistant: " + productName);
            } else if (!officialProducts.contains(officialValue)) {
                officialProducts.add(officialValue);
            }
        }
        return officialProducts.isEmpty() ? null : String.join("; ", officialProducts);
    }

    private boolean productsExist(String value) {
        List<String> productNames = productList(value);
        if (productNames.isEmpty()) {
            return false;
        }
        Map<String, String> products = productNameByKey();
        for (String productName : productNames) {
            if (!products.containsKey(normalizedKey(productName))) {
                return false;
            }
        }
        return true;
    }

    private String normalizeProductList(String value) {
        List<String> productNames = productList(value);
        return productNames.isEmpty() ? null : String.join("; ", productNames);
    }

    private List<String> productList(String value) {
        Set<String> products = new LinkedHashSet<>();
        String text = trimToNull(value);
        if (text == null) {
            return new ArrayList<>();
        }
        for (String product : text.split("[,;/\\r\\n]+")) {
            String trimmed = trimToNull(product);
            if (trimmed != null) {
                products.add(trimmed);
            }
        }
        return new ArrayList<>(products);
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
                // Invalid dates are ignored so optional imported values can remain blank.
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
        private final List<FinishedProductReferenceDto> createdProducts = new ArrayList<>();
        private final List<FinishedProductImportIssue> issues = new ArrayList<>();

        public int getCreatedCount() {
            return createdCount;
        }

        public int getSkippedCount() {
            return skippedCount;
        }

        public List<FinishedProductReferenceDto> getCreatedProducts() {
            return createdProducts;
        }

        public List<FinishedProductImportIssue> getIssues() {
            return issues;
        }

        public void created(FinishedProductReference product) {
            createdCount++;
            FinishedProductReferenceDto dto = new FinishedProductReferenceDto();
            dto.setId(product.getId());
            dto.setClient(product.getClient());
            dto.setProject(product.getProject());
            dto.setPartNumber(product.getPartNumber());
            dto.setDesignation(product.getDesignation());
            dto.setCustomerPn(product.getCustomerPn());
            dto.setProduct(product.getProduct());
            dto.setCoiffeIndex(product.getCoiffeIndex());
            dto.setDrawingIndex(product.getDrawingIndex());
            dto.setReducedCode(product.getReducedCode());
            dto.setSalePrice(product.getSalePrice());
            dto.setProductionIntegrationDate(product.getProductionIntegrationDate());
            dto.setComments(product.getComments());
            createdProducts.add(dto);
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
