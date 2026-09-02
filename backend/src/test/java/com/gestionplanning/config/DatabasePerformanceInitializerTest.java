package com.gestionplanning.config;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DatabasePerformanceInitializerTest {
    @Test
    void expandsProjectTeamColumnToTextForExistingDatabases() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

        new DatabasePerformanceInitializer(jdbcTemplate).run();

        verify(jdbcTemplate).execute("alter table project_reference alter column project_team type text");
    }
}
