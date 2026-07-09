package com.gestionplanning.penalty;

import org.springframework.stereotype.Component;

@Component
public class PenaltyMapper {
    public Penalty toEntity(PenaltyDto dto) {
        Penalty penalty = new Penalty();
        penalty.setPilot(dto.getPilot());
        penalty.setDelayType(dto.getDelayType());
        penalty.setAmount(dto.getAmount());
        penalty.setDate(dto.getDate());
        penalty.setComment(dto.getComment());
        return penalty;
    }

    public PenaltyDto toDto(Penalty penalty) {
        PenaltyDto dto = new PenaltyDto();
        dto.setId(penalty.getId());
        dto.setRequestId(penalty.getRequestId());
        dto.setPilot(penalty.getPilot());
        dto.setDelayType(penalty.getDelayType());
        dto.setAmount(penalty.getAmount());
        dto.setDate(penalty.getDate());
        dto.setComment(penalty.getComment());
        return dto;
    }
}
