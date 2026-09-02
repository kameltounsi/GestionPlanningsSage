package com.gestionplanning.project;

import org.junit.jupiter.api.Test;

import javax.persistence.Column;
import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProjectReferenceTest {
    @Test
    void storesProjectTeamAsTextWithoutThePreviousLengthLimit() throws Exception {
        Field projectTeam = ProjectReference.class.getDeclaredField("projectTeam");
        Column column = projectTeam.getAnnotation(Column.class);

        assertEquals("TEXT", column.columnDefinition());
    }
}
