package com.gestionplanning.document;

import org.springframework.stereotype.Component;

@Component
public class EcrDocumentMapper {
    public EcrDocument toEntity(EcrDocumentDto dto) {
        EcrDocument document = new EcrDocument();
        document.setFileName(dto.getFileName());
        document.setFileUrl(dto.getFileUrl());
        document.setPublicId(dto.getPublicId());
        document.setResourceType(dto.getResourceType());
        document.setFileType(dto.getFileType());
        document.setFileSize(dto.getFileSize());
        document.setUploadedBy(dto.getUploadedBy());
        return document;
    }

    public EcrDocumentDto toDto(EcrDocument document) {
        EcrDocumentDto dto = new EcrDocumentDto();
        dto.setId(document.getId());
        dto.setRequestId(document.getRequestId());
        dto.setFileName(document.getFileName());
        dto.setFileUrl(document.getFileUrl());
        dto.setPublicId(document.getPublicId());
        dto.setResourceType(document.getResourceType());
        dto.setFileType(document.getFileType());
        dto.setFileSize(document.getFileSize());
        dto.setUploadedBy(document.getUploadedBy());
        dto.setUploadedAt(document.getUploadedAt());
        return dto;
    }
}
