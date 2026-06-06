package com.gestionplanning.preferential;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleReferenceRepository extends JpaRepository<RoleReference, Long> {
    List<RoleReference> findAllByOrderByNameAsc();

    Optional<RoleReference> findByNameIgnoreCase(String name);
}
