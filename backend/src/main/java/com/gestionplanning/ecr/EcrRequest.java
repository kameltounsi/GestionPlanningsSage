package com.gestionplanning.ecr;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.gestionplanning.action.EcrAction;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
public class EcrRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer accessInternalNumber;
    private String modificationNumber;

    @NotBlank
    @Column(nullable = false)
    private String client;

    private String product;

    @Column(length = 3000)
    private String modificationProject;

    private LocalDate receptionDate;
    private LocalDate sopDate;
    private String pilot;
    @Column(length = 3000)
    private String modificationReason;
    @Column(length = 5000)
    private String modificationDetail;
    private String beforePhoto;
    private String beforePhotoContentType;
    private Long beforePhotoFileSize;
    @Column(length = 2000)
    private String beforePhotoUrl;
    private String beforePhotoPublicId;
    private String beforePhotoResourceType;
    private String afterPhoto;
    private String afterPhotoContentType;
    private Long afterPhotoFileSize;
    @Column(length = 2000)
    private String afterPhotoUrl;
    private String afterPhotoPublicId;
    private String afterPhotoResourceType;
    private String mixability;
    @Column(length = 5000)
    private String dossierReview;
    private String technicalFile;
    private String clientPlanning;
    private String internalPlanning;
    private String oilList;
    @Column(length = 5000)
    private String report;
    private boolean digitChange;
    private boolean componentChange;
    private boolean processChange;
    private boolean supplierChange;
    private boolean newVersion;
    private boolean feasibilityValidation;
    private LocalDate feasibilityValidationDate;
    private boolean internalCostingStatus;
    private LocalDate internalCostingDate;
    private boolean internalVpValidation;
    private LocalDate internalVpValidationDate;
    private boolean customerValidation;
    private LocalDate customerValidationDate;
    private boolean ppapValidation;
    private LocalDate ppapValidationDate;
    private boolean closureStatus;
    private LocalDate closureDate;
    private boolean cancelledStatus;
    private LocalDate cancelledDate;
    @Enumerated(EnumType.STRING)
    private EcrStage cancelledFromStage;
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean archived = false;
    private String accessProjectTimeline;
    private String accessProjectManagement;
    private String accessProductDevelopment;
    private String accessProcessDevelopment;
    private String accessProductionSetup;
    private String accessLaunch;
    private String accessProjectCancelled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EcrStage currentStage = EcrStage.FEASIBILITY_VALIDATION;

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<ChecklistItem> checklistItems = new ArrayList<>();

    @Transient
    private List<EcrAction> initialActions = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public Integer getAccessInternalNumber() {
        return accessInternalNumber;
    }

    public void setAccessInternalNumber(Integer accessInternalNumber) {
        this.accessInternalNumber = accessInternalNumber;
    }

    public String getModificationNumber() {
        return modificationNumber;
    }

    public void setModificationNumber(String modificationNumber) {
        this.modificationNumber = modificationNumber;
    }

    public String getClient() {
        return client;
    }

    public void setClient(String client) {
        this.client = client;
    }

    public String getProduct() {
        return product;
    }

    public void setProduct(String product) {
        this.product = product;
    }

    public String getModificationProject() {
        return modificationProject;
    }

    public void setModificationProject(String modificationProject) {
        this.modificationProject = modificationProject;
    }

    public LocalDate getReceptionDate() {
        return receptionDate;
    }

    public void setReceptionDate(LocalDate receptionDate) {
        this.receptionDate = receptionDate;
    }

    public LocalDate getSopDate() {
        return sopDate;
    }

    public void setSopDate(LocalDate sopDate) {
        this.sopDate = sopDate;
    }

    public String getPilot() {
        return pilot;
    }

    public void setPilot(String pilot) {
        this.pilot = pilot;
    }

    public String getModificationReason() {
        return modificationReason;
    }

    public void setModificationReason(String modificationReason) {
        this.modificationReason = modificationReason;
    }

    public String getModificationDetail() {
        return modificationDetail;
    }

    public void setModificationDetail(String modificationDetail) {
        this.modificationDetail = modificationDetail;
    }

    public String getBeforePhoto() {
        return beforePhoto;
    }

    public void setBeforePhoto(String beforePhoto) {
        this.beforePhoto = beforePhoto;
    }

    public String getBeforePhotoContentType() {
        return beforePhotoContentType;
    }

    public void setBeforePhotoContentType(String beforePhotoContentType) {
        this.beforePhotoContentType = beforePhotoContentType;
    }

    public Long getBeforePhotoFileSize() {
        return beforePhotoFileSize;
    }

    public void setBeforePhotoFileSize(Long beforePhotoFileSize) {
        this.beforePhotoFileSize = beforePhotoFileSize;
    }

    public String getBeforePhotoUrl() {
        return beforePhotoUrl;
    }

    public void setBeforePhotoUrl(String beforePhotoUrl) {
        this.beforePhotoUrl = beforePhotoUrl;
    }

    public String getBeforePhotoPublicId() {
        return beforePhotoPublicId;
    }

    public void setBeforePhotoPublicId(String beforePhotoPublicId) {
        this.beforePhotoPublicId = beforePhotoPublicId;
    }

    public String getBeforePhotoResourceType() {
        return beforePhotoResourceType;
    }

    public void setBeforePhotoResourceType(String beforePhotoResourceType) {
        this.beforePhotoResourceType = beforePhotoResourceType;
    }

    public String getAfterPhoto() {
        return afterPhoto;
    }

    public void setAfterPhoto(String afterPhoto) {
        this.afterPhoto = afterPhoto;
    }

    public String getAfterPhotoContentType() {
        return afterPhotoContentType;
    }

    public void setAfterPhotoContentType(String afterPhotoContentType) {
        this.afterPhotoContentType = afterPhotoContentType;
    }

    public Long getAfterPhotoFileSize() {
        return afterPhotoFileSize;
    }

    public void setAfterPhotoFileSize(Long afterPhotoFileSize) {
        this.afterPhotoFileSize = afterPhotoFileSize;
    }

    public String getAfterPhotoUrl() {
        return afterPhotoUrl;
    }

    public void setAfterPhotoUrl(String afterPhotoUrl) {
        this.afterPhotoUrl = afterPhotoUrl;
    }

    public String getAfterPhotoPublicId() {
        return afterPhotoPublicId;
    }

    public void setAfterPhotoPublicId(String afterPhotoPublicId) {
        this.afterPhotoPublicId = afterPhotoPublicId;
    }

    public String getAfterPhotoResourceType() {
        return afterPhotoResourceType;
    }

    public void setAfterPhotoResourceType(String afterPhotoResourceType) {
        this.afterPhotoResourceType = afterPhotoResourceType;
    }

    public String getMixability() {
        return mixability;
    }

    public void setMixability(String mixability) {
        this.mixability = mixability;
    }

    public String getDossierReview() {
        return dossierReview;
    }

    public void setDossierReview(String dossierReview) {
        this.dossierReview = dossierReview;
    }

    public String getTechnicalFile() {
        return technicalFile;
    }

    public void setTechnicalFile(String technicalFile) {
        this.technicalFile = technicalFile;
    }

    public String getClientPlanning() {
        return clientPlanning;
    }

    public void setClientPlanning(String clientPlanning) {
        this.clientPlanning = clientPlanning;
    }

    public String getInternalPlanning() {
        return internalPlanning;
    }

    public void setInternalPlanning(String internalPlanning) {
        this.internalPlanning = internalPlanning;
    }

    public String getOilList() {
        return oilList;
    }

    public void setOilList(String oilList) {
        this.oilList = oilList;
    }

    public String getReport() {
        return report;
    }

    public void setReport(String report) {
        this.report = report;
    }

    public boolean isDigitChange() {
        return digitChange;
    }

    public void setDigitChange(boolean digitChange) {
        this.digitChange = digitChange;
    }

    public boolean isComponentChange() {
        return componentChange;
    }

    public void setComponentChange(boolean componentChange) {
        this.componentChange = componentChange;
    }

    public boolean isProcessChange() {
        return processChange;
    }

    public void setProcessChange(boolean processChange) {
        this.processChange = processChange;
    }

    public boolean isSupplierChange() {
        return supplierChange;
    }

    public void setSupplierChange(boolean supplierChange) {
        this.supplierChange = supplierChange;
    }

    public boolean isNewVersion() {
        return newVersion;
    }

    public void setNewVersion(boolean newVersion) {
        this.newVersion = newVersion;
    }

    public boolean isFeasibilityValidation() {
        return feasibilityValidation;
    }

    public void setFeasibilityValidation(boolean feasibilityValidation) {
        this.feasibilityValidation = feasibilityValidation;
    }

    public LocalDate getFeasibilityValidationDate() {
        return feasibilityValidationDate;
    }

    public void setFeasibilityValidationDate(LocalDate feasibilityValidationDate) {
        this.feasibilityValidationDate = feasibilityValidationDate;
    }

    public boolean isInternalCostingStatus() {
        return internalCostingStatus;
    }

    public void setInternalCostingStatus(boolean internalCostingStatus) {
        this.internalCostingStatus = internalCostingStatus;
    }

    public LocalDate getInternalCostingDate() {
        return internalCostingDate;
    }

    public void setInternalCostingDate(LocalDate internalCostingDate) {
        this.internalCostingDate = internalCostingDate;
    }

    public boolean isInternalVpValidation() {
        return internalVpValidation;
    }

    public void setInternalVpValidation(boolean internalVpValidation) {
        this.internalVpValidation = internalVpValidation;
    }

    public LocalDate getInternalVpValidationDate() {
        return internalVpValidationDate;
    }

    public void setInternalVpValidationDate(LocalDate internalVpValidationDate) {
        this.internalVpValidationDate = internalVpValidationDate;
    }

    public boolean isCustomerValidation() {
        return customerValidation;
    }

    public void setCustomerValidation(boolean customerValidation) {
        this.customerValidation = customerValidation;
    }

    public LocalDate getCustomerValidationDate() {
        return customerValidationDate;
    }

    public void setCustomerValidationDate(LocalDate customerValidationDate) {
        this.customerValidationDate = customerValidationDate;
    }

    public boolean isPpapValidation() {
        return ppapValidation;
    }

    public void setPpapValidation(boolean ppapValidation) {
        this.ppapValidation = ppapValidation;
    }

    public LocalDate getPpapValidationDate() {
        return ppapValidationDate;
    }

    public void setPpapValidationDate(LocalDate ppapValidationDate) {
        this.ppapValidationDate = ppapValidationDate;
    }

    public boolean isClosureStatus() {
        return closureStatus;
    }

    public void setClosureStatus(boolean closureStatus) {
        this.closureStatus = closureStatus;
    }

    public LocalDate getClosureDate() {
        return closureDate;
    }

    public void setClosureDate(LocalDate closureDate) {
        this.closureDate = closureDate;
    }

    public boolean isCancelledStatus() {
        return cancelledStatus;
    }

    public void setCancelledStatus(boolean cancelledStatus) {
        this.cancelledStatus = cancelledStatus;
    }

    public LocalDate getCancelledDate() {
        return cancelledDate;
    }

    public void setCancelledDate(LocalDate cancelledDate) {
        this.cancelledDate = cancelledDate;
    }

    public EcrStage getCancelledFromStage() {
        return cancelledFromStage;
    }

    public void setCancelledFromStage(EcrStage cancelledFromStage) {
        this.cancelledFromStage = cancelledFromStage;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public String getAccessProjectTimeline() {
        return accessProjectTimeline;
    }

    public void setAccessProjectTimeline(String accessProjectTimeline) {
        this.accessProjectTimeline = accessProjectTimeline;
    }

    public String getAccessProjectManagement() {
        return accessProjectManagement;
    }

    public void setAccessProjectManagement(String accessProjectManagement) {
        this.accessProjectManagement = accessProjectManagement;
    }

    public String getAccessProductDevelopment() {
        return accessProductDevelopment;
    }

    public void setAccessProductDevelopment(String accessProductDevelopment) {
        this.accessProductDevelopment = accessProductDevelopment;
    }

    public String getAccessProcessDevelopment() {
        return accessProcessDevelopment;
    }

    public void setAccessProcessDevelopment(String accessProcessDevelopment) {
        this.accessProcessDevelopment = accessProcessDevelopment;
    }

    public String getAccessProductionSetup() {
        return accessProductionSetup;
    }

    public void setAccessProductionSetup(String accessProductionSetup) {
        this.accessProductionSetup = accessProductionSetup;
    }

    public String getAccessLaunch() {
        return accessLaunch;
    }

    public void setAccessLaunch(String accessLaunch) {
        this.accessLaunch = accessLaunch;
    }

    public String getAccessProjectCancelled() {
        return accessProjectCancelled;
    }

    public void setAccessProjectCancelled(String accessProjectCancelled) {
        this.accessProjectCancelled = accessProjectCancelled;
    }

    public EcrStage getCurrentStage() {
        return currentStage;
    }

    public void setCurrentStage(EcrStage currentStage) {
        this.currentStage = currentStage;
    }

    public List<ChecklistItem> getChecklistItems() {
        return checklistItems;
    }

    public List<EcrAction> getInitialActions() {
        return initialActions;
    }

    public void setInitialActions(List<EcrAction> initialActions) {
        this.initialActions = initialActions == null ? new ArrayList<>() : initialActions;
    }

    public void addChecklistItem(ChecklistItem item) {
        checklistItems.add(item);
        item.setRequest(this);
    }
}
