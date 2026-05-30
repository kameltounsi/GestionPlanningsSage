package com.gestionplanning.user;

import com.gestionplanning.auth.PasswordService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DefaultUserInitializer implements CommandLineRunner {
    private final AppUserRepository userRepository;
    private final PasswordService passwordService;

    public DefaultUserInitializer(AppUserRepository userRepository, PasswordService passwordService) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
    }

    @Override
    public void run(String... args) {
        ensureDefaultAdmin();
    }

    private void ensureDefaultAdmin() {
        boolean[] created = { false };
        AppUser user = userRepository.findByUsername("fchelbi")
                .orElseGet(() -> userRepository.findByEmail("f.chalbi@sagetunisia.com").orElseGet(() -> {
                    created[0] = true;
                    return new AppUser();
                }));
        user.setFullName(valueOrDefault(user.getFullName(), "Fethi Chelbi"));
        user.setUsername("fchelbi");
        user.setJobTitle(valueOrDefault(user.getJobTitle(), "Engineering Manager"));
        user.setEmail("f.chalbi@sagetunisia.com");
        if (created[0] || user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            user.setPassword(passwordService.encode("fchelbi"));
        }
        user.setRole(UserRole.ADMIN);
        user.setEnabled(true);
        userRepository.save(user);
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.trim().isEmpty() ? defaultValue : value;
    }
}
