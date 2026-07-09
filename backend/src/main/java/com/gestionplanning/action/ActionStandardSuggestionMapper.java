package com.gestionplanning.action;

import org.springframework.stereotype.Component;

@Component
public class ActionStandardSuggestionMapper {
    public ActionStandardSuggestionDto toDto(ActionStandardSuggestion suggestion) {
        return ActionStandardSuggestionDto.from(suggestion);
    }
}
