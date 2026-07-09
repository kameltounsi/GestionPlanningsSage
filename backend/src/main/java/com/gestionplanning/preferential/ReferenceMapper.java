package com.gestionplanning.preferential;

import org.springframework.stereotype.Component;

@Component
public class ReferenceMapper {
    public ClientReference toClientEntity(ReferenceDto dto) {
        ClientReference entity = new ClientReference();
        updateClientEntity(entity, dto);
        return entity;
    }

    public void updateClientEntity(ClientReference entity, ReferenceDto dto) {
        entity.setName(dto.getName().trim());
    }

    public ReferenceDto toDto(ClientReference entity) {
        return new ReferenceDto(entity.getId(), entity.getName());
    }

    public ProductReference toProductEntity(ReferenceDto dto) {
        ProductReference entity = new ProductReference();
        updateProductEntity(entity, dto);
        return entity;
    }

    public void updateProductEntity(ProductReference entity, ReferenceDto dto) {
        entity.setName(dto.getName().trim());
    }

    public ReferenceDto toDto(ProductReference entity) {
        return new ReferenceDto(entity.getId(), entity.getName());
    }

    public RoleReference toRoleEntity(ReferenceDto dto) {
        RoleReference entity = new RoleReference();
        updateRoleEntity(entity, dto);
        return entity;
    }

    public void updateRoleEntity(RoleReference entity, ReferenceDto dto) {
        entity.setName(dto.getName().trim());
    }

    public ReferenceDto toDto(RoleReference entity) {
        return new ReferenceDto(entity.getId(), entity.getName());
    }
}
