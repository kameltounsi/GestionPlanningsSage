package com.gestionplanning.pilot;

import javax.persistence.Entity;
import javax.persistence.Id;

@Entity
public class Pilot {
    @Id
    private String name;
    private String manager;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getManager() {
        return manager;
    }

    public void setManager(String manager) {
        this.manager = manager;
    }
}
