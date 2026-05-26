package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;

import javax.persistence.*;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;

@Entity
@Table(name = "action_planning_rule")
public class ActionPlanningRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EcrStage stage = EcrStage.FEASIBILITY_VALIDATION;

    @NotBlank
    @Column(nullable = false, length = 1000)
    private String actionTitle;

    @Column(length = 1000)
    private String dependencyActionTitle;

    @Column(nullable = false)
    private String dependencyAnchor = "OUTPUT";

    @Min(0)
    @Column(nullable = false)
    private Integer durationDays = 1;

    public Long getId() {
        return id;
    }

    public EcrStage getStage() {
        return stage;
    }

    public void setStage(EcrStage stage) {
        this.stage = stage;
    }

    public String getActionTitle() {
        return actionTitle;
    }

    public void setActionTitle(String actionTitle) {
        this.actionTitle = actionTitle;
    }

    public String getDependencyActionTitle() {
        return dependencyActionTitle;
    }

    public void setDependencyActionTitle(String dependencyActionTitle) {
        this.dependencyActionTitle = dependencyActionTitle;
    }

    public String getDependencyAnchor() {
        return dependencyAnchor;
    }

    public void setDependencyAnchor(String dependencyAnchor) {
        this.dependencyAnchor = dependencyAnchor;
    }

    public Integer getDurationDays() {
        return durationDays;
    }

    public void setDurationDays(Integer durationDays) {
        this.durationDays = durationDays;
    }
}
