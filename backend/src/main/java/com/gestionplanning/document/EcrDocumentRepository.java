package com.gestionplanning.document;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EcrDocumentRepository extends JpaRepository<EcrDocument, Long> {
    List<EcrDocument> findByRequest_IdOrderByUploadedAtDescIdDesc(Long requestId);
}
