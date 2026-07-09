package com.gestionplanning.ecr;

import org.springframework.stereotype.Component;

@Component
public class PhaseValidationRequestMapper {
    public PhaseValidationRequestDto toDto(PhaseValidationRequest validation) {
        return PhaseValidationRequestDto.from(validation);
    }
}
