package com.gestionplanning.action;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;

@Entity
public class EcrActionEvidence {
    @Id
    private Long actionId;

    @Column(columnDefinition = "bytea")
    private byte[] data;

    public EcrActionEvidence() {
    }

    public EcrActionEvidence(Long actionId, byte[] data) {
        this.actionId = actionId;
        this.data = data;
    }

    public Long getActionId() {
        return actionId;
    }

    public void setActionId(Long actionId) {
        this.actionId = actionId;
    }

    public byte[] getData() {
        return data;
    }

    public void setData(byte[] data) {
        this.data = data;
    }
}
