package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.user.AppUser;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.io.ByteArrayOutputStream;
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
    private final EcrRequestRepository requestRepository;
    private final FinishedProductReferenceMapper finishedProductMapper;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;

    public FinishedProductReferenceController(FinishedProductReferenceRepository repository,
                                              ClientReferenceRepository clientRepository,
                                              ProjectReferenceRepository projectRepository,
                                              ProductReferenceRepository productRepository,
                                              EcrRequestRepository requestRepository,
                                              FinishedProductReferenceMapper finishedProductMapper,
                                              AuditLogService auditLogService,
                                              AccessControlService accessControlService) {
        this.repository = repository;
        this.clientRepository = clientRepository;
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.requestRepository = requestRepository;
        this.finishedProductMapper = finishedProductMapper;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<FinishedProductReferenceDto> list() {
        return repository.findAllByOrderByProjectAscProductAscPartNumberAsc().stream()
                .map(finishedProductMapper::toDto)
                .collect(Collectors.toList());
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportFile(@RequestParam(value = "projects", required = false) List<String> projects,
                                             @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        Set<String> projectFilter = projectFilter(projects);
        List<FinishedProductReference> references = filteredReferences(projectFilter, user);

        try {
            byte[] content = exportWorkbook(references);
            String fileName = projectFilter.isEmpty() ? "produits-finis.xlsx" : "produits-finis-projets.xlsx";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment().filename(fileName).build());
            headers.setContentLength(content.length);
            return new ResponseEntity<>(content, headers, HttpStatus.OK);
        } catch (IOException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/export-with-modifications")
    public ResponseEntity<byte[]> exportWithModifications(@RequestParam(value = "projects", required = false) List<String> projects,
                                                          @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        Set<String> projectFilter = projectFilter(projects);
        List<FinishedProductReference> references = filteredReferences(projectFilter, user);
        List<EcrRequest> requests = requestRepository.findAllByOrderByReceptionDateDescIdDesc().stream()
                .filter(request -> projectFilter.isEmpty() || projectFilter.contains(normalizedKey(request.getModificationProject())))
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .collect(Collectors.toList());
        try {
            byte[] content = exportMatrixWorkbook(references, requests);
            String fileName = projectFilter.isEmpty() ? "produits-finis-avec-modifications.xlsx" : "produits-finis-avec-modifications-projets.xlsx";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment().filename(fileName).build());
            headers.setContentLength(content.length);
            return new ResponseEntity<>(content, headers, HttpStatus.OK);
        } catch (IOException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
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
        FinishedProductReference entity = finishedProductMapper.toEntity(finishedProduct);
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
        return ResponseEntity.ok(finishedProductMapper.toDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Object> update(@PathVariable Long id,
                                    @Valid @RequestBody FinishedProductReferenceDto updatedFinishedProduct,
                                    @RequestAttribute("authenticatedUser") Object userAttribute) {
                                        AppUser user = (AppUser) userAttribute;
        FinishedProductReference updatedEntity = finishedProductMapper.toEntity(updatedFinishedProduct);
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
                    finishedProductMapper.copyInto(updatedEntity, finishedProduct);
                    try {
                        return ResponseEntity.ok((Object) finishedProductMapper.toDto(repository.save(finishedProduct)));
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
            result.created(saved, finishedProductMapper);
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

    private Set<String> projectFilter(List<String> projects) {
        return projects == null ? new HashSet<>() : projects.stream()
                .map(this::normalizedKey)
                .filter(value -> value != null)
                .collect(Collectors.toSet());
    }

    private List<FinishedProductReference> filteredReferences(Set<String> projectFilter, AppUser user) {
        return repository.findAllByOrderByProjectAscProductAscPartNumberAsc().stream()
                .filter(reference -> projectFilter.isEmpty() || projectFilter.contains(normalizedKey(reference.getProject())))
                .filter(reference -> accessControlService.canManageFinishedProduct(user, reference.getProject()))
                .collect(Collectors.toList());
    }

    private byte[] exportWorkbook(List<FinishedProductReference> references) throws IOException {
        try (org.apache.poi.ss.usermodel.Workbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Produits finis");
            String[] headers = {
                    "client",
                    "project",
                    "partNumber",
                    "designation",
                    "customerPn",
                    "product",
                    "coiffeIndex",
                    "drawingIndex",
                    "reducedCode",
                    "salePrice",
                    "productionIntegrationDate",
                    "comments"
            };
            Row headerRow = sheet.createRow(0);
            for (int column = 0; column < headers.length; column++) {
                headerRow.createCell(column).setCellValue(headers[column]);
            }
            org.apache.poi.ss.usermodel.CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd"));
            org.apache.poi.ss.usermodel.CellStyle amountStyle = workbook.createCellStyle();
            amountStyle.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("#,##0.000"));

            for (int index = 0; index < references.size(); index++) {
                Row row = sheet.createRow(index + 1);
                FinishedProductReference reference = references.get(index);
                writeText(row, 0, reference.getClient());
                writeText(row, 1, reference.getProject());
                writeText(row, 2, reference.getPartNumber());
                writeText(row, 3, reference.getDesignation());
                writeText(row, 4, reference.getCustomerPn());
                writeText(row, 5, reference.getProduct());
                writeText(row, 6, reference.getCoiffeIndex());
                writeText(row, 7, reference.getDrawingIndex());
                writeText(row, 8, reference.getReducedCode());
                if (reference.getSalePrice() != null) {
                    Cell salePriceCell = row.createCell(9);
                    salePriceCell.setCellValue(reference.getSalePrice().doubleValue());
                    salePriceCell.setCellStyle(amountStyle);
                }
                if (reference.getProductionIntegrationDate() != null) {
                    Cell dateCell = row.createCell(10);
                    dateCell.setCellValue(java.sql.Date.valueOf(reference.getProductionIntegrationDate()));
                    dateCell.setCellStyle(dateStyle);
                }
                writeText(row, 11, reference.getComments());
            }
            for (int column = 0; column < headers.length; column++) {
                sheet.autoSizeColumn(column);
            }
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private byte[] exportMatrixWorkbook(List<FinishedProductReference> references, List<EcrRequest> requests) throws IOException {
        try (org.apache.poi.ss.usermodel.Workbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("CHANGE MATRIX");
            MatrixStyles styles = matrixStyles(workbook);
            setupMatrixSheet(sheet);
            writeMatrixTitle(sheet, styles, references);
            int rowIndex = 3;
            rowIndex = writeProgressiveRegister(sheet, styles, references, requests, rowIndex);
            rowIndex += 2;
            writeProductRegister(sheet, styles, references, rowIndex);
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private void setupMatrixSheet(Sheet sheet) {
        int[] widths = {5, 34, 32, 16, 16, 16, 16, 16, 16, 16};
        for (int column = 0; column < widths.length; column++) {
            sheet.setColumnWidth(column, widths[column] * 256);
        }
        sheet.createFreezePane(0, 5);
        sheet.setDisplayGridlines(false);
    }

    private void writeMatrixTitle(Sheet sheet, MatrixStyles styles, List<FinishedProductReference> references) {
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(24);
        merge(sheet, 0, 1, 0, 5);
        cell(titleRow, 1, "CHANGE MANAGEMENT MATRIX", styles.title);
        Row subtitleRow = sheet.createRow(1);
        subtitleRow.setHeightInPoints(22);
        merge(sheet, 1, 1, 1, 5);
        String projectLabel = references.stream().map(FinishedProductReference::getProject).filter(value -> value != null)
                .distinct().collect(Collectors.joining(" / "));
        cell(subtitleRow, 1, projectLabel.isEmpty() ? "Produits finis" : "Coiffes " + projectLabel, styles.title);
        cell(subtitleRow, 6, java.sql.Date.valueOf(LocalDate.now()), styles.date);
        cell(subtitleRow, 8, "INDEX", styles.index);
        cell(subtitleRow, 9, 1, styles.index);
    }

    private int writeProgressiveRegister(Sheet sheet, MatrixStyles styles, List<FinishedProductReference> references,
                                         List<EcrRequest> requests, int rowIndex) {
        Row sectionRow = sheet.createRow(rowIndex++);
        merge(sheet, rowIndex - 1, 1, rowIndex - 1, 9);
        cell(sectionRow, 1, "Progressive register changes", styles.section);
        Row headerRow = sheet.createRow(rowIndex++);
        String[] headers = {"Version", "Change description", "Modification number", "Pilot", "Status", "Reception date", "DR drawing", "DR digit", "SOP date"};
        for (int column = 0; column < headers.length; column++) {
            cell(headerRow, column + 1, headers[column], styles.header);
        }
        for (FinishedProductReference reference : references) {
            List<EcrRequest> productRequests = matchingRequests(reference, requests);
            Row productRow = sheet.createRow(rowIndex++);
            cell(productRow, 1, productVersion(reference), styles.product);
            cell(productRow, 2, "INITIAL RELEASE", styles.body);
            cell(productRow, 6, reference.getProductionIntegrationDate() == null ? null : java.sql.Date.valueOf(reference.getProductionIntegrationDate()), styles.date);
            cell(productRow, 7, reference.getDrawingIndex(), styles.bodyCenter);
            cell(productRow, 8, reference.getCoiffeIndex(), styles.bodyCenter);

            if (productRequests.isEmpty()) {
                Row emptyRow = sheet.createRow(rowIndex++);
                cell(emptyRow, 2, "Aucune modification associee", styles.bodyMuted);
                applyEmptyRowBorders(emptyRow, styles, 1, 9);
                continue;
            }
            for (EcrRequest request : productRequests) {
                Row row = sheet.createRow(rowIndex++);
                cell(row, 2, changeDescription(request), styles.body);
                cell(row, 3, request.getModificationNumber(), styles.bodyCenter);
                cell(row, 4, request.getPilot(), styles.body);
                cell(row, 5, request.getCurrentStage() == null ? null : request.getCurrentStage().name(), styles.bodyCenter);
                cell(row, 6, request.getReceptionDate() == null ? null : java.sql.Date.valueOf(request.getReceptionDate()), styles.date);
                cell(row, 7, reference.getDrawingIndex(), styles.bodyCenter);
                cell(row, 8, digitLabel(request, reference), styles.bodyCenter);
                cell(row, 9, request.getSopDate() == null ? null : java.sql.Date.valueOf(request.getSopDate()), styles.date);
                applyEmptyRowBorders(row, styles, 1, 9);
            }
        }
        return rowIndex;
    }

    private void writeProductRegister(Sheet sheet, MatrixStyles styles, List<FinishedProductReference> references, int rowIndex) {
        Row sectionRow = sheet.createRow(rowIndex++);
        merge(sheet, rowIndex - 1, 1, rowIndex - 1, 9);
        cell(sectionRow, 1, "Registro codici fodere", styles.section);
        Row headerRow = sheet.createRow(rowIndex++);
        String[] headers = {"Allestimento", "DESCRIZIONE", "Cover PN", "IND,C", "Customer PN", "Projet", "Code reduit", "DR\nDISEGNI", "DR\nDIME"};
        for (int column = 0; column < headers.length; column++) {
            cell(headerRow, column + 1, headers[column], styles.header);
        }
        String previousProduct = null;
        for (FinishedProductReference reference : references) {
            Row row = sheet.createRow(rowIndex++);
            String product = reference.getProduct();
            cell(row, 1, product == null || product.equals(previousProduct) ? null : product, styles.bodyCenter);
            cell(row, 2, reference.getDesignation(), styles.body);
            cell(row, 3, reference.getPartNumber(), styles.bodyCenter);
            cell(row, 4, reference.getCoiffeIndex(), styles.bodyCenter);
            cell(row, 5, reference.getCustomerPn(), styles.bodyCenter);
            cell(row, 6, reference.getProject(), styles.bodyCenter);
            cell(row, 7, reference.getReducedCode(), styles.bodyCenter);
            cell(row, 8, reference.getDrawingIndex(), styles.bodyCenter);
            cell(row, 9, reference.getCoiffeIndex(), styles.bodyCenter);
            previousProduct = product;
        }
    }

    private void writeText(Row row, int column, String value) {
        if (value != null) {
            row.createCell(column).setCellValue(value);
        }
    }

    private List<EcrRequest> matchingRequests(FinishedProductReference reference, List<EcrRequest> requests) {
        Set<String> productKeys = new HashSet<>();
        addKey(productKeys, reference.getPartNumber());
        addKey(productKeys, reference.getReducedCode());
        addKey(productKeys, reference.getDesignation());
        String projectKey = normalizedKey(reference.getProject());
        return requests.stream()
                .filter(request -> projectKey != null && projectKey.equals(normalizedKey(request.getModificationProject())))
                .filter(request -> requestMatchesFinishedProduct(request, productKeys))
                .sorted((left, right) -> {
                    int dateCompare = nullSafeDate(left.getReceptionDate()).compareTo(nullSafeDate(right.getReceptionDate()));
                    if (dateCompare != 0) {
                        return dateCompare;
                    }
                    return String.valueOf(left.getModificationNumber()).compareToIgnoreCase(String.valueOf(right.getModificationNumber()));
                })
                .collect(Collectors.toList());
    }

    private boolean requestMatchesFinishedProduct(EcrRequest request, Set<String> productKeys) {
        if (request == null || productKeys.isEmpty()) {
            return false;
        }
        Set<String> requestKeys = new HashSet<>();
        addSplitKeys(requestKeys, request.getFinishedProducts());
        addSplitKeys(requestKeys, request.getProduct());
        for (String key : productKeys) {
            if (requestKeys.contains(key) || normalizedTextContains(request.getFinishedProducts(), key)) {
                return true;
            }
        }
        return false;
    }

    private LocalDate nullSafeDate(LocalDate date) {
        return date == null ? LocalDate.of(1900, 1, 1) : date;
    }

    private String productVersion(FinishedProductReference reference) {
        String designation = trimToNull(reference.getDesignation());
        if (designation != null) {
            return designation;
        }
        return trimToNull(reference.getPartNumber()) == null ? reference.getReducedCode() : reference.getPartNumber();
    }

    private String changeDescription(EcrRequest request) {
        String reason = trimToNull(request.getModificationReason());
        String detail = trimToNull(request.getModificationDetail());
        if (reason != null && detail != null) {
            return reason + " - " + detail;
        }
        if (detail != null) {
            return detail;
        }
        return reason == null ? "Modification" : reason;
    }

    private String digitLabel(EcrRequest request, FinishedProductReference reference) {
        String coiffe = trimToNull(reference.getCoiffeIndex());
        if (request.isDigitChange() && coiffe != null) {
            return coiffe;
        }
        return request.isDigitChange() ? "Oui" : coiffe;
    }

    private void addSplitKeys(Set<String> keys, String value) {
        String text = trimToNull(value);
        if (text == null) {
            return;
        }
        for (String part : text.split("[,;/\\r\\n|]+")) {
            addKey(keys, part);
        }
    }

    private void addKey(Set<String> keys, String value) {
        String key = normalizedKey(value);
        if (key != null) {
            keys.add(key);
        }
    }

    private boolean normalizedTextContains(String text, String key) {
        String normalizedText = normalizedKey(text);
        return normalizedText != null && key != null && normalizedText.contains(key);
    }

    private void merge(Sheet sheet, int firstRow, int firstColumn, int lastRow, int lastColumn) {
        sheet.addMergedRegion(new CellRangeAddress(firstRow, lastRow, firstColumn, lastColumn));
    }

    private void cell(Row row, int column, Object value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value instanceof java.util.Date) {
            cell.setCellValue((java.util.Date) value);
        } else if (value instanceof Number) {
            cell.setCellValue(((Number) value).doubleValue());
        } else if (value != null) {
            cell.setCellValue(String.valueOf(value));
        }
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private void applyEmptyRowBorders(Row row, MatrixStyles styles, int firstColumn, int lastColumn) {
        for (int column = firstColumn; column <= lastColumn; column++) {
            Cell cell = row.getCell(column);
            if (cell == null) {
                cell = row.createCell(column);
            }
            if (cell.getCellStyle() == null || cell.getCellStyle().getIndex() == 0) {
                cell.setCellStyle(styles.body);
            }
        }
    }

    private MatrixStyles matrixStyles(Workbook workbook) {
        MatrixStyles styles = new MatrixStyles();
        short dateFormat = workbook.getCreationHelper().createDataFormat().getFormat("dd-mmm-yy");
        styles.title = style(workbook, true, 16, null, HorizontalAlignment.CENTER, true);
        styles.index = style(workbook, false, 14, null, HorizontalAlignment.CENTER, true);
        styles.date = style(workbook, false, 10, null, HorizontalAlignment.CENTER, true);
        styles.date.setDataFormat(dateFormat);
        styles.section = style(workbook, true, 11, IndexedColors.LIGHT_GREEN, HorizontalAlignment.LEFT, true);
        styles.header = style(workbook, true, 9, IndexedColors.ROSE, HorizontalAlignment.CENTER, true);
        styles.body = style(workbook, false, 9, null, HorizontalAlignment.LEFT, true);
        styles.bodyCenter = style(workbook, false, 9, null, HorizontalAlignment.CENTER, true);
        styles.bodyMuted = style(workbook, false, 9, IndexedColors.GREY_25_PERCENT, HorizontalAlignment.LEFT, true);
        styles.product = style(workbook, true, 9, null, HorizontalAlignment.LEFT, true);
        return styles;
    }

    private CellStyle style(Workbook workbook, boolean bold, int fontSize, IndexedColors fill,
                            HorizontalAlignment alignment, boolean border) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setFontName("Verdana");
        font.setFontHeightInPoints((short) fontSize);
        font.setBold(bold);
        style.setFont(font);
        style.setAlignment(alignment);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        if (fill != null) {
            style.setFillForegroundColor(fill.getIndex());
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        if (border) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
        return style;
    }

    private static class MatrixStyles {
        private CellStyle title;
        private CellStyle index;
        private CellStyle date;
        private CellStyle section;
        private CellStyle header;
        private CellStyle body;
        private CellStyle bodyCenter;
        private CellStyle bodyMuted;
        private CellStyle product;
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

        public void created(FinishedProductReference product, FinishedProductReferenceMapper mapper) {
            createdCount++;
            createdProducts.add(mapper.toDto(product));
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
