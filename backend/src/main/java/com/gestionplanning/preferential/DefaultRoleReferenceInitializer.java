package com.gestionplanning.preferential;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class DefaultRoleReferenceInitializer implements CommandLineRunner {
    private static final List<String> DEFAULT_ROLES = Arrays.asList(
            "Admin",
            "Chef de projet",
            "Manager",
            "Superviseur couture",
            "Superviseur coupe",
            "Superviseur logistique",
            "Magasinier",
            "CAO",
            "Process",
            "Approvisionneur",
            "Achat NPP",
            "Achat central",
            "Qualité projet",
            "Qualité production",
            "Auditeur qualité"
    );

    private final RoleReferenceRepository repository;

    public DefaultRoleReferenceInitializer(RoleReferenceRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        DEFAULT_ROLES.forEach(name -> repository.findByNameIgnoreCase(name).orElseGet(() -> {
            RoleReference role = new RoleReference();
            role.setName(name);
            return repository.save(role);
        }));
    }
}
