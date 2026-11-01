package com.gestionplanning.ecr;

import javax.persistence.Column;
import javax.persistence.Embeddable;

@Embeddable
public class TimelineSelection {
    @Column(name = "timeline_name", length = 160)
    private String name;
    @Column(name = "timeline_comment", length = 5000)
    private String comment;

    public TimelineSelection() {}
    public TimelineSelection(String name, String comment) {
        this.name = name;
        this.comment = comment;
    }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
