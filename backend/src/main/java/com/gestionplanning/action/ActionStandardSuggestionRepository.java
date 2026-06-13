package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActionStandardSuggestionRepository extends JpaRepository<ActionStandardSuggestion, Long> {
    List<ActionStandardSuggestion> findByStatusOrderByCreatedAtDescIdDesc(ActionStandardSuggestionStatus status);

    Optional<ActionStandardSuggestion> findFirstByActionIdAndStatus(Long actionId, ActionStandardSuggestionStatus status);
}
