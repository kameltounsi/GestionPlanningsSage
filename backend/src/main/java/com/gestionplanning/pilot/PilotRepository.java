package com.gestionplanning.pilot;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PilotRepository extends JpaRepository<Pilot, String> {
    List<Pilot> findAllByOrderByNameAsc();
}
