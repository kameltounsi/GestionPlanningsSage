package com.gestionplanning.pilot;

import org.springframework.stereotype.Component;

@Component
public class PilotMapper {
    public Pilot toEntity(PilotDto dto) {
        Pilot pilot = new Pilot();
        pilot.setName(dto.getName());
        pilot.setManager(dto.getManager());
        return pilot;
    }

    public PilotDto toDto(Pilot pilot) {
        return new PilotDto(pilot.getName(), pilot.getManager());
    }
}
