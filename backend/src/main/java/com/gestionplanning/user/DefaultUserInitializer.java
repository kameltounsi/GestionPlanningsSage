package com.gestionplanning.user;

import com.gestionplanning.auth.PasswordService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DefaultUserInitializer implements CommandLineRunner {
    private static final String DEFAULT_ADMIN_USERNAME = "fchelbi";
    private static final String DEFAULT_ADMIN_EMAIL = "f.chalbi1@sagetunisia.com";
    private static final String DEFAULT_ADMIN_PHONE = "+21698139382";
    private static final String DEFAULT_ADMIN_INITIAL_SECRET = DEFAULT_ADMIN_USERNAME;

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
        AppUser user = userRepository.findByUsername(DEFAULT_ADMIN_USERNAME)
                .orElseGet(() -> userRepository.findByEmail(DEFAULT_ADMIN_EMAIL).orElseGet(() -> {
                    created[0] = true;
                    return new AppUser();
                }));
        user.setFullName(valueOrDefault(user.getFullName(), "Fethi Chelbi"));
        user.setUsername(DEFAULT_ADMIN_USERNAME);
        user.setJobTitle(valueOrDefault(user.getJobTitle(), "Engineering Manager"));
        user.setEmail(DEFAULT_ADMIN_EMAIL);
        user.setPhone(valueOrDefault(user.getPhone(), DEFAULT_ADMIN_PHONE));
        if (created[0] || user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            user.setPassword(passwordService.encode(DEFAULT_ADMIN_INITIAL_SECRET));
        }
        user.setRole(UserRole.ADMIN.name() + ";" + UserRole.ENGINEERING_MANAGER.name());
        user.setEnabled(true);
        userRepository.save(user);
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.trim().isEmpty() ? defaultValue : value;
    }
}
