package com.gestionplanning.preferential;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TimelineReferenceRepository extends JpaRepository<TimelineReference, Long> {
    List<TimelineReference> findAllByOrderByNameAsc();

    boolean existsByName(String name);
}
