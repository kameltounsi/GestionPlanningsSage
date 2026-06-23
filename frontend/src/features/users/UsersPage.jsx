import React, { useEffect, useMemo, useState } from "react";
import { Camera, Pencil, Plus, Save, Trash2, UserCircle, X } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { emptyUserForm } from "../../constants/forms";
import { userRoleOptions } from "../../constants/roles";
import { userRoleLabel } from "../../utils/users";

export function UsersPage({ actionRoleOptions = [], currentUser, editingUser, saving, userForm, users, onCancelEdit, onDelete, onEdit, onSubmit, setUserForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentRole = String(currentUser?.role || "").trim().toLowerCase().replaceAll("_", " ");
  const canAdmin = currentUser?.username === "fchelbi" || currentRole === "admin";

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
      <PageHeader eyebrow="Administration" title="Utilisateurs" subtitle="Création et maintenance des comptes applicatifs par l'administrateur fchelbi." />
      {!canAdmin && <EmptyState title="Accès admin requis" text="Connectez-vous avec fchelbi pour administrer les utilisateurs." />}
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
              <EmptyState title="Aucun utilisateur" text="Ajoutez un premier compte pour démarrer l'administration." />
            ) : (
              users.map((user) => (
                <article className="user-row" key={user.id}>
                  <div className="avatar-cell">
                    {user.profilePhotoUrl ? <img alt="" src={user.profilePhotoUrl} /> : <UserCircle size={24} />}
                  </div>
                  <div className="user-identity"><strong>{user.fullName}</strong><span>{user.jobTitle || "-"}</span></div>
                  <div className="user-account"><strong>{user.username || "-"}</strong><span>{user.email}</span></div>
                  <div className="user-chefs"><strong>Chef 1: {userLabelForValue(users, user.chef1)}</strong><span>Chef 2: {userLabelForValue(users, user.chef2)}</span></div>
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
          actionRoleOptions={actionRoleOptions}
          saving={saving}
          users={users}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setUserForm}
        />
      )}
    </section>
  );
}

function UserDialog({ actionRoleOptions = [], canAdmin, editingUser, form, saving, users = [], onClose, onSubmit, setForm }) {
  const [localPhotoPreviewUrl, setLocalPhotoPreviewUrl] = useState("");
  const historicalRoleLabels = userRoleOptions.map(([, label]) => label);
  const roleOptions = [
    ...userRoleOptions.map(([value, label]) => ({ value, label })),
    ...actionRoleOptions
      .filter((role) => !historicalRoleLabels.includes(role))
      .map((role) => ({ value: role, label: role }))
  ];
  const displayedRoleOptions = form.role && !roleOptions.some((role) => role.value === form.role)
    ? [{ value: form.role, label: userRoleLabel(form.role) }, ...roleOptions]
    : roleOptions;
  const previewPhotoUrl = localPhotoPreviewUrl || form.profilePhotoUrl || "";
  const chefOptions = userSelectOptions(users, form, editingUser);

  useEffect(() => {
    if (!form.profilePhotoFile) {
      setLocalPhotoPreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(form.profilePhotoFile);
    setLocalPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [form.profilePhotoFile]);

  function updateUsername(value) {
    setForm((current) => ({
      ...current,
      username: value,
      password: editingUser ? current.password : value
    }));
  }

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
            <p>Le username et l'email doivent rester uniques. Le mot de passe initial est defini seulement a la creation.</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <section className="user-photo-uploader">
          <div className="user-photo-preview">
            {previewPhotoUrl ? <img alt="" src={previewPhotoUrl} /> : <UserCircle size={54} />}
          </div>
          <div className="user-photo-copy">
            <strong>Photo de profil</strong>
            <span>{form.profilePhotoFile ? form.profilePhotoFile.name : "Aucune photo sélectionnée"}</span>
          </div>
          <label className="secondary-action compact-action user-photo-action">
            <Camera size={15} />
            {previewPhotoUrl ? "Remplacer" : "Ajouter"}
            <input accept="image/*" disabled={!canAdmin} type="file" onChange={(event) => setForm((current) => ({ ...current, profilePhotoFile: event.target.files?.[0] || null }))} />
          </label>
        </section>
        <div className="field-grid">
          <label>
            Nom complet
            <input required disabled={!canAdmin} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label>
            Username
            <input required disabled={!canAdmin} value={form.username} onChange={(event) => updateUsername(event.target.value)} />
          </label>
          <label>
            Poste
            <input disabled={!canAdmin} value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
          </label>
          <label>
            Email
            <input autoComplete="email" required disabled={!canAdmin} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          {!editingUser && (
            <label>
              Mot de passe
              <input required disabled={!canAdmin} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            </label>
          )}
          <label>
            Telephone
            <input autoComplete="tel" disabled={!canAdmin} inputMode="tel" pattern="\\+?[0-9\\s().-]{8,20}" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Chef 1
            <select required disabled={!canAdmin} value={form.chef1} onChange={(event) => setForm((current) => ({ ...current, chef1: event.target.value }))}>
              <option value="">Selectionner chef 1</option>
              {chefOptions.map(({ value, label }) => (
                <option key={`chef1-${value}`} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Chef 2
            <select required disabled={!canAdmin} value={form.chef2} onChange={(event) => setForm((current) => ({ ...current, chef2: event.target.value }))}>
              <option value="">Selectionner chef 2</option>
              {chefOptions.map(({ value, label }) => (
                <option key={`chef2-${value}`} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Rôle applicatif
            <select disabled={!canAdmin} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              {displayedRoleOptions.map(({ value, label }) => (
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

function userSelectOptions(users, form, editingUser) {
  const options = users
    .filter((user) => user?.username)
    .map((user) => ({
      value: normalizeUserKey(user.username),
      label: `${user.fullName || user.username} (${user.username})`
    }));
  const selfValue = normalizeUserKey(form.username);
  if (selfValue && !options.some((option) => option.value === selfValue)) {
    options.unshift({
      value: selfValue,
      label: `${form.fullName || selfValue} (${editingUser ? "lui-meme" : "nouvel utilisateur"})`
    });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function userLabelForValue(users, value) {
  const key = normalizeUserKey(value);
  if (!key) return "-";
  const user = users.find((item) => [item.username, item.email, item.fullName].map(normalizeUserKey).includes(key));
  return user ? user.fullName || user.username : value;
}

function normalizeUserKey(value) {
  return String(value || "").trim().toLowerCase();
}
