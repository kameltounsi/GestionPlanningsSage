package com.gestionplanning.preferential;

import javax.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

public class FinishedProductReferenceDto {
    private Long id;

    @NotBlank
    private String client;

    @NotBlank
    private String project;

    @NotBlank
    private String partNumber;

    private String designation;
    private String customerPn;

    @NotBlank
    private String product;

    private String coiffeIndex;
    private String drawingIndex;

    @NotBlank
    private String reducedCode;

    private BigDecimal salePrice;
    private LocalDate productionIntegrationDate;
    private String comments;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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
