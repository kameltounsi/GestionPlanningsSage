import React, { useState } from "react";
import { Pencil, Plus, Save, Trash2, UserCircle, X } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { emptyUserForm } from "../../constants/forms";
import { userRoleOptions } from "../../constants/roles";
import { userRoleLabel } from "../../utils/users";

export function UsersPage({ currentUser, editingUser, saving, userForm, users, onCancelEdit, onDelete, onEdit, onSubmit, setUserForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canAdmin = currentUser?.username === "fchelbi" || currentUser?.role === "ADMIN";

  function openCreateDialog() {
    setUserForm(emptyUserForm);
    setDialogOpen(true);
  }

  function openEditDialog(user) {
    onEdit(user);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    onCancelEdit();
  }

  function submitDialog(event) {
    onSubmit(event);
    setDialogOpen(false);
  }

  return (
    <section className="page-content users-content">
      <PageHeader eyebrow="Administration" title="Utilisateurs" subtitle="Creation et maintenance des comptes applicatifs par l'administrateur fchelbi." />
      {!canAdmin && <EmptyState title="Acces admin requis" text="Connectez-vous avec fchelbi pour administrer les utilisateurs." />}
      <div className="users-layout">
        <section className="panel">
          <div className="section-title">
            <h2>Liste des utilisateurs</h2>
            <div className="row-actions">
              <span>{users.length} comptes</span>
              <button className="primary-action compact-action" disabled={!canAdmin} type="button" onClick={openCreateDialog}>
                <Plus size={16} />
                Ajouter un utilisateur
              </button>
            </div>
          </div>
          <div className="user-table">
            {users.length === 0 ? (
              <EmptyState title="Aucun utilisateur" text="Ajoutez un premier compte pour demarrer l'administration." />
            ) : (
              users.map((user) => (
                <article className="user-row" key={user.id}>
                  <div className="avatar-cell">
                    {user.profilePhotoUrl ? <img alt="" src={user.profilePhotoUrl} /> : <UserCircle size={24} />}
                  </div>
                  <div><strong>{user.fullName}</strong><span>{user.jobTitle || "-"}</span></div>
                  <div><strong>{user.username || "-"}</strong><span>{user.email}</span></div>
                  <small className="status in_progress">{userRoleLabel(user.role)}</small>
                  <div className="row-actions">
                    <button className="secondary-action compact-action icon-only-action" disabled={!canAdmin} type="button" onClick={() => openEditDialog(user)} aria-label="Modifier l'utilisateur" title="Modifier">
                      <Pencil size={15} />
                    </button>
                    <button className="ghost-icon" disabled={!canAdmin || user.id === currentUser?.id} type="button" onClick={() => onDelete(user.id)} title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      {dialogOpen && (
        <UserDialog
          canAdmin={canAdmin}
          editingUser={editingUser}
          form={userForm}
          saving={saving}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setUserForm}
        />
      )}
    </section>
  );
}

function UserDialog({ canAdmin, editingUser, form, saving, onClose, onSubmit, setForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="user-dialog-title"
        aria-modal="true"
        className="dialog-card user-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <h2 id="user-dialog-title">{editingUser ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h2>
            <p>Le username et l'email doivent rester uniques. Le mot de passe est requis seulement a la creation.</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="field-grid">
          <label>
            Nom complet
            <input required disabled={!canAdmin} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label>
            Username
            <input required disabled={!canAdmin} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
          </label>
          <label>
            Poste
            <input disabled={!canAdmin} value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
          </label>
          <label>
            Email
            <input required disabled={!canAdmin} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Mot de passe
            <input required={!editingUser} disabled={!canAdmin} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
          </label>
          <label>
            Telephone
            <input disabled={!canAdmin} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Role
            <select disabled={!canAdmin} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              {userRoleOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="asset-required-field user-enabled-field">
            <input disabled={!canAdmin} checked={form.enabled} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Compte actif
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={saving || !canAdmin} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}
