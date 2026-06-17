package com.gestionplanning.preferential;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import javax.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(uniqueConstraints = {
        @UniqueConstraint(columnNames = "part_number"),
        @UniqueConstraint(columnNames = "reduced_code")
})
public class FinishedProductReference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(length = 160)
    private String client;

    @NotBlank
    @Column(nullable = false, length = 160)
    private String project;

    @NotBlank
    @Column(name = "part_number", nullable = false, length = 160)
    private String partNumber;

    @Column(length = 500)
    private String designation;

    @Column(length = 160)
    private String customerPn;

    @NotBlank
    @Column(nullable = false, length = 160)
    private String product;

    @Column(length = 80)
    private String coiffeIndex;

    @Column(length = 80)
    private String drawingIndex;

    @NotBlank
    @Column(name = "reduced_code", nullable = false, length = 160)
    private String reducedCode;

    private BigDecimal salePrice;

    private LocalDate productionIntegrationDate;

    @Column(length = 3000)
    private String comments;

    public Long getId() {
        return id;
    }

    public String getClient() {
        return client;
    }

    public void setClient(String client) {
        this.client = client;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public String getPartNumber() {
        return partNumber;
    }

    public void setPartNumber(String partNumber) {
        this.partNumber = partNumber;
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getCustomerPn() {
        return customerPn;
    }

    public void setCustomerPn(String customerPn) {
        this.customerPn = customerPn;
    }

    public String getProduct() {
        return product;
    }

    public void setProduct(String product) {
        this.product = product;
    }

    public String getCoiffeIndex() {
        return coiffeIndex;
    }

    public void setCoiffeIndex(String coiffeIndex) {
        this.coiffeIndex = coiffeIndex;
    }

    public String getDrawingIndex() {
        return drawingIndex;
    }

    public void setDrawingIndex(String drawingIndex) {
        this.drawingIndex = drawingIndex;
    }

    public String getReducedCode() {
        return reducedCode;
    }

    public void setReducedCode(String reducedCode) {
        this.reducedCode = reducedCode;
    }

    public BigDecimal getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
    }

    public LocalDate getProductionIntegrationDate() {
        return productionIntegrationDate;
    }

    public void setProductionIntegrationDate(LocalDate productionIntegrationDate) {
        this.productionIntegrationDate = productionIntegrationDate;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }
}
