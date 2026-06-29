package com.gestionplanning.project;

import javax.validation.constraints.NotBlank;

public class ProjectReferenceDto {
    @NotBlank
    private String name;

    private String projectTeam;

    public ProjectReferenceDto() {
    }

    public ProjectReferenceDto(String name, String projectTeam) {
        this.name = name;
        this.projectTeam = projectTeam;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getProjectTeam() {
        return projectTeam;
    }

    public void setProjectTeam(String projectTeam) {
        this.projectTeam = projectTeam;
    }
}
