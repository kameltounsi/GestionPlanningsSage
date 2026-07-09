package com.gestionplanning.ecr;

import org.springframework.stereotype.Component;

@Component
public class EcrRequestMapper {
    public EcrRequestDto toDto(EcrRequest request) {
        return EcrRequestDto.from(request);
    }

    public EcrRequestDto toListItemDto(EcrRequest request) {
        return EcrRequestDto.fromListItem(request);
    }
}
