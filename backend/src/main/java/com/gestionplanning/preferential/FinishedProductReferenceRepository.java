package com.gestionplanning.preferential;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FinishedProductReferenceRepository extends JpaRepository<FinishedProductReference, Long> {
    List<FinishedProductReference> findAllByOrderByProjectAscProductAscPartNumberAsc();
}
