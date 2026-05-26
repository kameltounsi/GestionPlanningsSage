package com.gestionplanning.ecr;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EcrRequestRepository extends JpaRepository<EcrRequest, Long> {
    List<EcrRequest> findAllByOrderByReceptionDateDescIdDesc();
}
