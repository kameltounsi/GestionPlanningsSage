package com.gestionplanning;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GestionPlanningApplication {
    public static void main(String[] args) {
        SpringApplication.run(GestionPlanningApplication.class, args);
    }
}
