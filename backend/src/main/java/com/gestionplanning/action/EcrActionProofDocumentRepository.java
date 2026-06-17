package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EcrActionProofDocumentRepository extends JpaRepository<EcrActionProofDocument, Long> {
    List<EcrActionProofDocument> findByAction_IdOrderByUploadedAtDescIdDesc(Long actionId);

    void deleteByAction_Id(Long actionId);
}
