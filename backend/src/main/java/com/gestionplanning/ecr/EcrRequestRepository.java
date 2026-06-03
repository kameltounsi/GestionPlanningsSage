package com.gestionplanning.ecr;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EcrRequestRepository extends JpaRepository<EcrRequest, Long> {
    List<EcrRequest> findAllByOrderByReceptionDateDescIdDesc();

    @Query("select coalesce(max(request.accessInternalNumber), 0) from EcrRequest request")
    Integer findMaxAccessInternalNumber();
}
