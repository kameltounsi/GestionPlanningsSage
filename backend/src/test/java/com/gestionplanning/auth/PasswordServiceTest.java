package com.gestionplanning.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordServiceTest {
    private final PasswordService passwordService = new PasswordService();

    @Test
    void encodeCreatesPbkdf2HashThatMatchesRawPassword() {
        String encoded = passwordService.encode("secret-value");

        assertTrue(passwordService.isEncoded(encoded));
        assertTrue(passwordService.matches("secret-value", encoded));
        assertFalse(passwordService.matches("wrong-value", encoded));
    }

    @Test
    void encodeUsesDifferentSaltForEachHash() {
        String first = passwordService.encode("secret-value");
        String second = passwordService.encode("secret-value");

        assertNotEquals(first, second);
        assertTrue(passwordService.matches("secret-value", first));
        assertTrue(passwordService.matches("secret-value", second));
    }

    @Test
    void matchesSupportsLegacyPlainTextPasswords() {
        assertTrue(passwordService.matches("legacy", "legacy"));
        assertFalse(passwordService.matches("legacy", "different"));
        assertFalse(passwordService.matches(null, "legacy"));
        assertFalse(passwordService.matches("legacy", null));
    }
}
