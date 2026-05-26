package com.gestionplanning.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectReferenceRepository extends JpaRepository<ProjectReference, String> {
    List<ProjectReference> findAllByOrderByNameAsc();
}
