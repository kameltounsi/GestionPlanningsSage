package com.gestionplanning.auth;

import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthenticatedUserService {
    private final AppUserRepository userRepository;

    public AuthenticatedUserService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Optional<AppUser> find(Long userId) {
        return userId == null ? Optional.empty() : userRepository.findById(userId).filter(AppUser::isEnabled);
    }

    public AppUser require(Long userId) {
        return find(userId).orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));
    }
}
