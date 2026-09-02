package com.gestionplanning.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Component
public class DatabasePerformanceInitializer implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(DatabasePerformanceInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabasePerformanceInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(String... args) {
        LOGGER.info("Ensuring project teams use an unlimited TEXT column");
        jdbcTemplate.execute("alter table project_reference alter column project_team type text using project_team::text");

        List<String> statements = Arrays.asList(
                "create index if not exists idx_auth_token_expires_at on auth_token (expires_at)",
                "create index if not exists idx_auth_token_user_id on auth_token (user_id)",
                "create index if not exists idx_password_reset_code_user_used_created on password_reset_code (user_id, used, created_at desc, id desc)",
                "create index if not exists idx_password_reset_code_expires_at on password_reset_code (expires_at)",
                "create index if not exists idx_ecr_request_archived_reception_id on ecr_request (archived, reception_date desc, id desc)",
                "create index if not exists idx_ecr_request_project on ecr_request (modification_project)",
                "create index if not exists idx_ecr_request_pilot on ecr_request (pilot)",
                "create index if not exists idx_ecr_request_stage on ecr_request (current_stage)",
                "create index if not exists idx_ecr_action_request_stage_dates on ecr_action (ecr_id, stage, start_date, end_date, deadline, created_at, id)",
                "create index if not exists idx_ecr_action_request_deadline on ecr_action (ecr_id, deadline, id)",
                "create index if not exists idx_ecr_action_responsible_lower on ecr_action (lower(responsible))",
                "create index if not exists idx_ecr_action_validator_lower on ecr_action (lower(validator))",
                "create index if not exists idx_ecr_action_validator_role_lower on ecr_action (lower(validator_role))",
                "create index if not exists idx_ecr_action_deadline_status on ecr_action (deadline, status)"
        );
        LOGGER.info("Ensuring {} database performance indexes", statements.size());
        statements.forEach(jdbcTemplate::execute);
    }
}
