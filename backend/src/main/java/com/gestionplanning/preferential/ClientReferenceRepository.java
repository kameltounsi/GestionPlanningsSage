package com.gestionplanning.preferential;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClientReferenceRepository extends JpaRepository<ClientReference, Long> {
    List<ClientReference> findAllByOrderByNameAsc();

    boolean existsByName(String name);
}
