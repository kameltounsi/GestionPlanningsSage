package com.gestionplanning.preferential;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductReferenceRepository extends JpaRepository<ProductReference, Long> {
    List<ProductReference> findAllByOrderByNameAsc();

    boolean existsByName(String name);
}
