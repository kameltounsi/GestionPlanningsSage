package com.gestionplanning.preferential;

import org.springframework.stereotype.Component;

@Component
public class FinishedProductReferenceMapper {
    public FinishedProductReference toEntity(FinishedProductReferenceDto dto) {
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

    public FinishedProductReferenceDto toDto(FinishedProductReference entity) {
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

    public void copyInto(FinishedProductReference source, FinishedProductReference target) {
        target.setClient(source.getClient());
        target.setProject(source.getProject());
        target.setPartNumber(source.getPartNumber());
        target.setDesignation(source.getDesignation());
        target.setCustomerPn(source.getCustomerPn());
        target.setProduct(source.getProduct());
        target.setCoiffeIndex(source.getCoiffeIndex());
        target.setDrawingIndex(source.getDrawingIndex());
        target.setReducedCode(source.getReducedCode());
        target.setSalePrice(source.getSalePrice());
        target.setProductionIntegrationDate(source.getProductionIntegrationDate());
        target.setComments(source.getComments());
    }
}
