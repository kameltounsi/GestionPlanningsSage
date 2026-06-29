package com.gestionplanning.auth;

import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthenticatedUserServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final AuthenticatedUserService service = new AuthenticatedUserService(userRepository);

    @Test
    void findReturnsEmptyWhenUserIdIsNull() {
        assertFalse(service.find(null).isPresent());
        verify(userRepository, never()).findById(null);
    }

    @Test
    void findReturnsEnabledUser() {
        AppUser user = new AppUser();
        user.setEnabled(true);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        Optional<AppUser> result = service.find(5L);

        assertTrue(result.isPresent());
        assertSame(user, result.get());
    }

    @Test
    void findFiltersDisabledUser() {
        AppUser user = new AppUser();
        user.setEnabled(false);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        assertFalse(service.find(5L).isPresent());
    }

    @Test
    void requireThrowsWhenUserIsMissing() {
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.require(9L));
    }
}
