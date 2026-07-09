package com.gestionplanning.action;

import org.springframework.stereotype.Component;

@Component
public class EcrActionMapper {
    public EcrActionDto toDto(EcrAction action) {
        return EcrActionDto.from(action);
    }
}
