package com.gestionplanning.preferential;

import javax.validation.constraints.NotBlank;

public class ReferenceDto {
    private Long id;
    private String comment;

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    @NotBlank
    private String name;

    public ReferenceDto() {
    }

    public ReferenceDto(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
