package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EcrActionAssetRepository extends JpaRepository<EcrActionAsset, Long> {
    List<EcrActionAsset> findByAction_IdOrderByUploadedAtDescIdDesc(Long actionId);

    List<EcrActionAsset> findByAction_Request_Id(Long requestId);

    void deleteByAction_Id(Long actionId);
}
