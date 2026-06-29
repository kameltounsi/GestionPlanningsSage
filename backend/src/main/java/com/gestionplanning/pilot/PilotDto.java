package com.gestionplanning.pilot;

public class PilotDto {
    private String name;
    private String manager;

    public PilotDto() {
    }

    public PilotDto(String name, String manager) {
        this.name = name;
        this.manager = manager;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getManager() { return manager; }
    public void setManager(String manager) { this.manager = manager; }
}
