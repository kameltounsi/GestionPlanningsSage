import React from "react";
import { CircleAlert } from "lucide-react";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { AskAiFinishedProductPage, MessagingPage } from "../features/messaging/MessagingPage";
import { PreferentialsPage } from "../features/preferentials/PreferentialsPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { TraceabilityPage } from "../features/traceability/TraceabilityPage";
import { UsersPage } from "../features/users/UsersPage";
import { emptyFinishedProductForm, emptyPlanningRuleForm, emptyUserForm } from "../constants/forms";

export function PageRouter({
  ModificationsPageComponent,
  actionForm,
  actionRoleOptions,
  actions,
  actionsByRequestId,
  actionSuggestions,
  auditActionFilter,
  auditActionOptions,
  auditLogs,
  auditQuery,
  chatDraft,
  chatFile,
  chatFileInputRef,
  chatGroupFormOpen,
  chatGroupMemberIds,
  chatGroupName,
  chatGroupProjectName,
  chatMessages,
  chatRecording,
  chatRecordingDuration,
  chatSending,
  chatTypingNotice,
  chatUsers,
  checklist,
  clientReferenceForm,
  clientReferences,
  completion,
  currentUser,
  dashboardStats,
  doneCount,
  downloadBlobFile,
  downloadHtmlAsPdf,
  downloadTextFile,
  editingClientReference,
  editingEcrRequest,
  editingFinishedProductReference,
  editingPlanningRule,
  editingProductReference,
  editingProject,
  editingRoleReference,
  editingUser,
  emptyFormFactories,
  error,
  errorAlert,
  filteredAuditLogs,
  filteredRequests,
  focusedActionId,
  setFocusedActionId,
  finishedProductReferenceForm,
  finishedProductReferences,
  handleAddChatGroupMember,
  handleAddEvidenceLink,
  handleApproveActionValidation,
  handleApprovePhase,
  handleArchiveEcr,
  handleCancelEcr,
  handleCancelVoiceRecording,
  handleChangePassword,
  handleChatDraftChange,
  handleChatFileChange,
  handleChatGroupProjectChange,
  handleCloseRequest,
  handleCreateAction,
  handleCreateChatGroup,
  handleDeleteAction,
  handleDeleteActionAsset,
  handleDeleteClientReference,
  handleDeleteFinishedProductReference,
  handleDeletePlanningRule,
  handleDeletePlanningRuleProofDocument,
  handleDeletePlanningRuleProofDocumentItem,
  handleDeleteProductReference,
  handleDeleteProject,
  handleDeleteRoleReference,
  handleDeleteUser,
  handleExportFinishedProducts,
  handleExportFinishedProductsWithModifications,
  handleImportFinishedProducts,
  handleRejectActionValidation,
  handleRejectPhase,
  handleReopenPhase,
  handleRequestActionValidation,
  handleRequestArchiveViewChange,
  handleRequestClosure,
  handleRequestPhaseValidation,
  handleSaveClientReference,
  handleSaveFinishedProductReference,
  handleSavePlanningRule,
  handleSaveProductReference,
  handleSaveProfile,
  handleSaveProject,
  handleSaveRoleReference,
  handleSaveUser,
  handleSelectChatUser,
  handleSendChatMessage,
  handleStageChange,
  handleStartVoiceRecording,
  handleStopVoiceRecording,
  handleToggleAction,
  handleToggleChatGroupMember,
  handleUpdateActionDuration,
  handleUpdateDossierReview,
  handleUploadEvidence,
  handleUploadUserPhoto,
  isAdminUser,
  isCriticalAction,
  lateActions,
  onCreateRequest,
  onOpenRequest,
  openEditEcr,
  page,
  passwordForm,
  phaseValidations,
  planningRuleForm,
  planningRules,
  productReferenceForm,
  productReferences,
  profileForm,
  projectFilter,
  projectForm,
  projectOptions,
  projects,
  query,
  refreshChatData,
  refreshAuditLogs,
  removeActionProofDocumentFile,
  requestArchiveView,
  requestSearchSuggestions,
  requestTypeFilter,
  requests,
  requiresEvidence,
  roleReferenceForm,
  roleReferences,
  saving,
  selectedChatUserId,
  selectedId,
  selectedRequest,
  selectedStage,
  setActionSuggestionsOpen,
  setSaving,
  setAuditActionFilter,
  setAuditLogs,
  setAuditQuery,
  setChatGroupFormOpen,
  setChatGroupName,
  setChatGroupProjectName,
  setClientReferenceForm,
  setEditingClientReference,
  setEditingFinishedProductReference,
  setEditingPlanningRule,
  setEditingProductReference,
  setEditingProject,
  setEditingRoleReference,
  setEditingUser,
  setFinishedProductReferenceForm,
  setPasswordForm,
  setPlanningRuleForm,
  setProductReferenceForm,
  setProfileForm,
  setProjectFilter,
  setProjectForm,
  setQuery,
  setRequestTypeFilter,
  setRoleReferenceForm,
  setSelectedId,
  setSelectedStage,
  setShowCreateForm,
  setUserForm,
  startClientReferenceEdit,
  startFinishedProductReferenceEdit,
  startPlanningRuleEdit,
  startProductReferenceEdit,
  startProjectEdit,
  startRoleReferenceEdit,
  startUserEdit,
  successToast,
  updateActionForm,
  userForm,
  users,
  visibleStages,
  warningAlert
}) {
  return (
    <>
      {error && (
        <div className="banner">
          <CircleAlert size={18} />
          {error}
        </div>
      )}

      {isAdminUser(currentUser) && actionSuggestions.length > 0 && (
        <div className="banner action-suggestion-banner">
          <CircleAlert size={18} />
          {actionSuggestions.length} action{actionSuggestions.length > 1 ? "s" : ""} creee{actionSuggestions.length > 1 ? "s" : ""} par pilote en attente de decision.
          <button className="secondary-action compact-action" type="button" onClick={() => setActionSuggestionsOpen(true)}>
            Voir
          </button>
        </div>
      )}

      {page === "dashboard" && (
        <DashboardPage
          clients={clientReferences}
          currentUser={currentUser}
          downloadBlobFile={downloadBlobFile}
          downloadHtmlAsPdf={downloadHtmlAsPdf}
          downloadTextFile={downloadTextFile}
          errorAlert={errorAlert}
          planningRules={planningRules}
          products={productReferences}
          projects={projects}
          requests={requests}
          roles={roleReferences}
          saving={saving}
          stats={dashboardStats}
          successToast={successToast}
          users={users}
          warningAlert={warningAlert}
          onCreateRequest={onCreateRequest}
          onOpenRequest={onOpenRequest}
        />
      )}

      {page === "projects" && (
        <ProjectsPage
          actionRoleOptions={actionRoleOptions}
          planningRuleForm={planningRuleForm}
          planningRules={planningRules}
          saving={saving}
          onCancelPlanningRuleEdit={() => {
            setEditingPlanningRule(null);
            setPlanningRuleForm(emptyFormFactories?.planningRule || emptyPlanningRuleForm);
          }}
          onDeletePlanningRule={handleDeletePlanningRule}
          onDeletePlanningRuleProofDocument={handleDeletePlanningRuleProofDocument}
          onDeletePlanningRuleProofDocumentItem={handleDeletePlanningRuleProofDocumentItem}
          onEditPlanningRule={startPlanningRuleEdit}
          onSubmitPlanningRule={handleSavePlanningRule}
          setPlanningRuleForm={setPlanningRuleForm}
        />
      )}

      {page === "ask-ai" && (
        <AskAiFinishedProductPage
          finishedProducts={finishedProductReferences}
          requests={requests}
          warningAlert={warningAlert}
          onOpenRequest={onOpenRequest}
        />
      )}

      {page === "traceability" && (
        <TraceabilityPage
          actionFilter={auditActionFilter}
          actionOptions={auditActionOptions}
          logs={filteredAuditLogs}
          query={auditQuery}
          total={auditLogs.length}
          onRefresh={refreshAuditLogs}
          setActionFilter={setAuditActionFilter}
          setQuery={setAuditQuery}
        />
      )}

      {page === "messages" && (
        <MessagingPage
          currentUser={currentUser}
          draft={chatDraft}
          file={chatFile}
          fileInputRef={chatFileInputRef}
          groupFormOpen={chatGroupFormOpen}
          groupMemberIds={chatGroupMemberIds}
          groupName={chatGroupName}
          groupProjectName={chatGroupProjectName}
          messages={chatMessages}
          projects={projects}
          selectedUserId={selectedChatUserId}
          sending={chatSending}
          typingNotice={chatTypingNotice}
          users={chatUsers}
          onClearFile={emptyFormFactories.clearChatFile}
          onCancelVoiceRecording={handleCancelVoiceRecording}
          onAddGroupMember={handleAddChatGroupMember}
          onCreateGroup={handleCreateChatGroup}
          onDraftChange={handleChatDraftChange}
          onFileChange={handleChatFileChange}
          onGroupMemberToggle={handleToggleChatGroupMember}
          onGroupProjectChange={handleChatGroupProjectChange}
          onRefresh={() => refreshChatData()}
          onSelectUser={handleSelectChatUser}
          onStartVoiceRecording={handleStartVoiceRecording}
          onStopVoiceRecording={handleStopVoiceRecording}
          onSend={handleSendChatMessage}
          recordingDuration={chatRecordingDuration}
          recordingSupported={Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined"}
          recordingVoice={chatRecording}
          setGroupFormOpen={setChatGroupFormOpen}
          setGroupName={setChatGroupName}
          setGroupProjectName={setChatGroupProjectName}
        />
      )}

      {page === "preferentials" && (
        <PreferentialsPage
          clientForm={clientReferenceForm}
          clients={clientReferences}
          currentUser={currentUser}
          editingClient={editingClientReference}
          editingFinishedProduct={editingFinishedProductReference}
          editingProduct={editingProductReference}
          editingProject={editingProject}
          editingRole={editingRoleReference}
          finishedProductForm={finishedProductReferenceForm}
          finishedProducts={finishedProductReferences}
          productForm={productReferenceForm}
          products={productReferences}
          projectForm={projectForm}
          projects={projects}
          roleForm={roleReferenceForm}
          roles={roleReferences}
          saving={saving}
          users={users}
          onCancelClientEdit={() => {
            setEditingClientReference(null);
            setClientReferenceForm({ name: "" });
          }}
          onCancelFinishedProductEdit={() => {
            setEditingFinishedProductReference(null);
            setFinishedProductReferenceForm(emptyFormFactories?.finishedProduct || emptyFinishedProductForm);
          }}
          onCancelProductEdit={() => {
            setEditingProductReference(null);
            setProductReferenceForm({ name: "" });
          }}
          onCancelRoleEdit={() => {
            setEditingRoleReference(null);
            setRoleReferenceForm({ name: "" });
          }}
          onCancelProjectEdit={() => {
            setEditingProject(null);
            setProjectForm({ name: "", projectTeam: "" });
          }}
          onDeleteClient={handleDeleteClientReference}
          onDeleteFinishedProduct={handleDeleteFinishedProductReference}
          onDeleteProduct={handleDeleteProductReference}
          onDeleteProject={handleDeleteProject}
          onDeleteRole={handleDeleteRoleReference}
          onEditClient={startClientReferenceEdit}
          onEditFinishedProduct={startFinishedProductReferenceEdit}
          onEditProduct={startProductReferenceEdit}
          onEditProject={startProjectEdit}
          onEditRole={startRoleReferenceEdit}
          onExportFinishedProducts={handleExportFinishedProducts}
          onExportFinishedProductsWithModifications={handleExportFinishedProductsWithModifications}
          onImportFinishedProducts={handleImportFinishedProducts}
          onSubmitClient={handleSaveClientReference}
          onSubmitFinishedProduct={handleSaveFinishedProductReference}
          onSubmitProduct={handleSaveProductReference}
          onSubmitProject={handleSaveProject}
          onSubmitRole={handleSaveRoleReference}
          setClientForm={setClientReferenceForm}
          setFinishedProductForm={setFinishedProductReferenceForm}
          setProductForm={setProductReferenceForm}
          setProjectForm={setProjectForm}
          setRoleForm={setRoleReferenceForm}
        />
      )}

      {page === "modifications" && (
        <ModificationsPageComponent
          actionForm={actionForm}
          actionRoleOptions={actionRoleOptions}
          actions={actions}
          actionsByRequestId={actionsByRequestId}
          auditLogs={auditLogs}
          checklist={checklist}
          completion={completion}
          doneCount={doneCount}
          downloadBlobFile={downloadBlobFile}
          downloadHtmlAsPdf={downloadHtmlAsPdf}
          downloadTextFile={downloadTextFile}
          errorAlert={errorAlert}
          filteredRequests={filteredRequests}
          focusedActionId={focusedActionId}
          setFocusedActionId={setFocusedActionId}
          currentUser={currentUser}
          lateActions={lateActions}
          phaseValidations={phaseValidations}
          projects={projects}
          projectFilter={projectFilter}
          projectOptions={projectOptions}
          query={query}
          requests={requests}
          requestSearchSuggestions={requestSearchSuggestions}
          requestArchiveView={requestArchiveView}
          requestTypeFilter={requestTypeFilter}
          saving={saving}
          selectedId={selectedId}
          selectedRequest={selectedRequest}
          selectedStages={visibleStages}
          selectedStage={selectedStage}
          setSaving={setSaving}
          successToast={successToast}
          setProjectFilter={setProjectFilter}
          setQuery={setQuery}
          setRequestTypeFilter={setRequestTypeFilter}
          setSelectedId={setSelectedId}
          setSelectedStage={setSelectedStage}
          setShowCreateForm={setShowCreateForm}
          onRequestArchiveViewChange={handleRequestArchiveViewChange}
          handleCreateAction={handleCreateAction}
          handleArchiveEcr={handleArchiveEcr}
          handleCancelEcr={handleCancelEcr}
          handleDeleteAction={handleDeleteAction}
          handleStageChange={handleStageChange}
          handleToggleAction={handleToggleAction}
          handleUpdateActionDuration={handleUpdateActionDuration}
          handleDeleteActionAsset={handleDeleteActionAsset}
          handleUploadEvidence={handleUploadEvidence}
          handleAddEvidenceLink={handleAddEvidenceLink}
          removeActionProofDocumentFile={removeActionProofDocumentFile}
          handleApprovePhase={handleApprovePhase}
          handleApproveActionValidation={handleApproveActionValidation}
          handleCloseRequest={handleCloseRequest}
          handleRejectActionValidation={handleRejectActionValidation}
          handleRequestActionValidation={handleRequestActionValidation}
          handleRejectPhase={handleRejectPhase}
          handleReopenPhase={handleReopenPhase}
          handleRequestClosure={handleRequestClosure}
          handleRequestPhaseValidation={handleRequestPhaseValidation}
          isCriticalAction={isCriticalAction}
          onEditRequest={openEditEcr}
          onUpdateDossierReview={handleUpdateDossierReview}
          requiresEvidence={requiresEvidence}
          updateActionForm={updateActionForm}
          users={users}
        />
      )}

      {page === "users" && (
        <UsersPage
          actionRoleOptions={actionRoleOptions}
          currentUser={currentUser}
          editingUser={editingUser}
          saving={saving}
          userForm={userForm}
          users={users}
          onCancelEdit={() => {
            setEditingUser(null);
            setUserForm(emptyFormFactories?.user || emptyUserForm);
          }}
          onDelete={handleDeleteUser}
          onEdit={startUserEdit}
          onSubmit={handleSaveUser}
          setUserForm={setUserForm}
        />
      )}

      {page === "profile" && (
        <ProfilePage
          currentUser={currentUser}
          passwordForm={passwordForm}
          profileForm={profileForm}
          saving={saving}
          onChangePassword={handleChangePassword}
          onSubmit={handleSaveProfile}
          onUploadPhoto={handleUploadUserPhoto}
          setPasswordForm={setPasswordForm}
          setProfileForm={setProfileForm}
        />
      )}
    </>
  );
}
