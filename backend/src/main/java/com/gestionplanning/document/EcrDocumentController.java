package com.gestionplanning.document;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api")
public class EcrDocumentController {
    private final EcrDocumentRepository documentRepository;
    private final EcrRequestRepository requestRepository;
    private final CloudinaryStorageService storageService;

    public EcrDocumentController(EcrDocumentRepository documentRepository, EcrRequestRepository requestRepository,
                                 CloudinaryStorageService storageService) {
        this.documentRepository = documentRepository;
        this.requestRepository = requestRepository;
        this.storageService = storageService;
    }

    @GetMapping("/ecr-requests/{requestId}/documents")
    public ResponseEntity<List<EcrDocument>> listByRequest(@PathVariable Long requestId) {
        if (!requestRepository.existsById(requestId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(documentRepository.findByRequest_IdOrderByUploadedAtDescIdDesc(requestId));
    }

    @PostMapping("/ecr-requests/{requestId}/documents")
    public ResponseEntity<EcrDocument> create(@PathVariable Long requestId, @Valid @RequestBody EcrDocument document) {
        return requestRepository.findById(requestId)
                .map(request -> {
                    document.setRequest(request);
                    EcrDocument saved = documentRepository.save(document);
                    return ResponseEntity.created(URI.create("/api/documents/" + saved.getId())).body(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/ecr-requests/{requestId}/documents/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrDocument> upload(@PathVariable Long requestId,
                                              @RequestParam("file") MultipartFile file,
                                              @RequestParam(value = "uploadedBy", required = false) String uploadedBy) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return requestRepository.findById(requestId)
                .map(request -> {
                    StoredAsset asset = storageService.upload(file, "gestion-planning/documents/" + requestId);
                    EcrDocument document = new EcrDocument();
                    document.setRequest(request);
                    document.setFileName(asset.getFileName());
                    document.setFileUrl(asset.getUrl());
                    document.setPublicId(asset.getPublicId());
                    document.setResourceType(asset.getResourceType());
                    document.setFileType(asset.getContentType());
                    document.setFileSize(asset.getSize());
                    document.setUploadedBy(uploadedBy);
                    EcrDocument saved = documentRepository.save(document);
                    return ResponseEntity.created(URI.create("/api/documents/" + saved.getId())).body(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/documents/{id}/download")
    public ResponseEntity<?> download(@PathVariable Long id) {
        return documentRepository.findById(id)
                .<ResponseEntity<?>>map(document -> {
                    DownloadedAsset asset = storageService.download(document.getPublicId(), document.getResourceType(), document.getFileUrl(), document.getFileType());
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(document.getFileName(), asset.getContentType()))
                            .contentType(MediaType.parseMediaType(asset.getContentType()))
                            .body(asset.getData());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!documentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        documentRepository.findById(id).ifPresent(document -> {
            storageService.deleteQuietly(document.getPublicId(), document.getResourceType());
            documentRepository.deleteById(id);
        });
        return ResponseEntity.noContent().build();
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "document";
        }
        return fileName.replace("\"", "");
    }

    private String contentDisposition(String fileName, String contentType) {
        String disposition = contentType != null && (contentType.equalsIgnoreCase(MediaType.APPLICATION_PDF_VALUE) || contentType.startsWith("image/"))
                ? "inline"
                : "attachment";
        return disposition + "; filename=\"" + safeFileName(fileName) + "\"";
    }
}
