package com.gestionplanning.action;

import java.text.Normalizer;
import java.util.Locale;

final class ActionCriticality {
    private ActionCriticality() {}

    static boolean isCritical(EcrAction action) {
        String value = action.getCriticality() == null ? "" : Normalizer.normalize(action.getCriticality(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").trim().toLowerCase(Locale.ROOT);
        return value.startsWith("1") || value.equals("critique") || value.equals("critical");
    }
}
