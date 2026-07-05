import React, { useEffect, useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Pencil, Plus, Save, Search, Trash2, UserCircle, X } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { emptyUserForm } from "../../constants/forms";
import { userRoleOptions } from "../../constants/roles";
import { safeImageUrl } from "../../utils/assets";
import { parseUserRoles, userRoleLabel } from "../../utils/users";

export function UsersPage({ actionRoleOptions = [], currentUser, editingUser, saving, userForm, users, onCancelEdit, onDelete, onEdit, onSubmit, setUserForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const currentRoles = parseUserRoles(currentUser?.role).map((role) => roleOptionKey(role));
  const canAdmin = currentUser?.username === "fchelbi" || currentRoles.includes("admin");
  const pageSize = 10;
  const roleFilterOptions = useMemo(() => {
    const options = userRoleOptions.map(([value, label]) => ({ value, label }));
    const seen = new Set(options.map((option) => roleOptionKey(option.label)));
    [
      ...actionRoleOptions,
      ...users.flatMap((user) => parseUserRoles(user.role))
    ].filter(Boolean).forEach((role) => {
      const label = userRoleLabel(role);
      const key = roleOptionKey(label);
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value: role, label });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [actionRoleOptions, users]);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeUserSearch(query);
    return users.filter((user) => {
      const matchesRole = !roleFilter || userMatchesRoleFilter(user, roleFilter);
      const matchesSearch = !normalizedQuery || [
        user.fullName,
        user.username,
        user.email,
        user.jobTitle,
        user.matricule,
        user.phone,
        userRoleLabel(user.role)
      ].filter(Boolean).some((value) => normalizeUserSearch(value).includes(normalizedQuery));
      return matchesRole && matchesSearch;
    });
  }, [query, roleFilter, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    return filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredUsers, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    const result = onSubmit(event);
    if (result && typeof result.then === "function") {
      result.then(() => setDialogOpen(false)).catch(() => {});
      return;
    }
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
              <span>{filteredUsers.length}/{users.length} comptes</span>
              <button className="primary-action compact-action" disabled={!canAdmin} type="button" onClick={openCreateDialog}>
                <Plus size={16} />
                Ajouter un utilisateur
              </button>
            </div>
          </div>
          <div className="users-toolbar">
            <div className="search users-search">
              <Search size={16} />
              <input
                aria-label="Rechercher un utilisateur"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher nom, email, username"
              />
            </div>
            <label className="project-filter users-role-filter">
              <UserCircle size={16} />
              <select aria-label="Filtrer par rôle" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="">Tous les rôles</option>
                {roleFilterOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="user-table">
            {filteredUsers.length === 0 ? (
              <EmptyState title="Aucun utilisateur" text="Aucun compte ne correspond aux filtres." />
            ) : (
              pagedUsers.map((user) => {
                const photoUrl = safeImageUrl(user.profilePhotoUrl);
                return (
                  <article className="user-row" key={user.id}>
                    <div className="avatar-cell">
                      {photoUrl ? <img alt="" src={photoUrl} /> : <UserCircle size={24} />}
                    </div>
                    <div className="user-identity"><strong>{user.fullName}</strong><span>{user.jobTitle || "-"}{user.matricule ? ` - Matricule ${user.matricule}` : ""}</span></div>
                    <div className="user-account"><strong>{user.username || "-"}</strong><span>{user.email}</span></div>
                    <div className="user-chefs"><strong>Chef 1: {userLabelForValue(users, user.chef1)}</strong><span>Chef 2: {userLabelForValue(users, user.chef2)}</span></div>
                    <ul className="user-role-list" aria-label="Roles applicatifs">
                      {parseUserRoles(user.role).length === 0 ? (
                        <li className="status in_progress">-</li>
                      ) : parseUserRoles(user.role).map((role) => (
                        <li className="status in_progress" key={role}>{userRoleLabel(role)}</li>
                      ))}
                    </ul>
                    <div className="row-actions">
                      <button className="secondary-action compact-action icon-only-action" disabled={!canAdmin} type="button" onClick={() => openEditDialog(user)} aria-label="Modifier l'utilisateur" title="Modifier">
                        <Pencil size={15} />
                      </button>
                      <button className="ghost-icon" disabled={!canAdmin || user.id === currentUser?.id} type="button" onClick={() => onDelete(user.id)} title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          {filteredUsers.length > pageSize && (
            <nav className="pagination users-pagination" aria-label="Pagination utilisateurs">
              <span>Page {Math.min(page, totalPages)} / {totalPages}</span>
              <div className="pagination-actions">
                <button className="ghost-icon" disabled={page <= 1} type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} title="Page précédente">
                  <ChevronLeft size={16} />
                </button>
                <button className="ghost-icon" disabled={page >= totalPages} type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} title="Page suivante">
                  <ChevronRight size={16} />
                </button>
              </div>
            </nav>
          )}
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
  const roleOptions = dedupeRoleOptions([
    ...userRoleOptions.map(([value, label]) => ({ value, label })),
    ...actionRoleOptions.map((role) => ({ value: role, label: role }))
  ]);
  const formRoles = parseUserRoles(form.role);
  const missingRoleOptions = formRoles
    .filter((formRole) => !roleOptions.some((role) => roleOptionKey(role.value) === roleOptionKey(formRole) || roleOptionKey(role.label) === roleOptionKey(userRoleLabel(formRole))))
    .map((formRole) => ({ value: formRole, label: userRoleLabel(formRole) }));
  const displayedRoleOptions = missingRoleOptions.length > 0
    ? [...missingRoleOptions, ...roleOptions]
    : roleOptions;
  const [roleSlotCount, setRoleSlotCount] = useState(Math.max(1, formRoles.length));
  const roleRows = Array.from({ length: Math.max(1, roleSlotCount, formRoles.length) }, (_, index) => formRoles[index] || "");
  const previewPhotoUrl = localPhotoPreviewUrl || safeImageUrl(form.profilePhotoUrl);
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

  useEffect(() => {
    setRoleSlotCount(Math.max(1, parseUserRoles(form.role).length));
  }, [editingUser]);

  function updateUsername(value) {
    setForm((current) => ({
      ...current,
      username: value,
      password: editingUser ? current.password : value
    }));
  }

  function updateRoleAt(index, value) {
    const nextRoles = roleRows
      .map((role, roleIndex) => roleIndex === index ? value : role)
      .filter(Boolean);
    setForm((current) => ({ ...current, role: nextRoles.join("; ") }));
  }

  function removeRoleAt(index) {
    const nextRoles = roleRows.filter((_, roleIndex) => roleIndex !== index).filter(Boolean);
    setRoleSlotCount(Math.max(1, roleSlotCount - 1));
    setForm((current) => ({ ...current, role: nextRoles.join("; ") }));
  }

  function addRoleSlot() {
    setRoleSlotCount((count) => Math.min(displayedRoleOptions.length, count + 1));
  }

  function roleOptionsForIndex(index) {
    const selectedKeys = new Set(roleRows
      .filter((_, roleIndex) => roleIndex !== index)
      .map(roleOptionKey)
      .filter(Boolean));
    return displayedRoleOptions.filter((option) => !selectedKeys.has(roleOptionKey(option.value)));
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
            <p>Le username, l'email et le téléphone doivent rester uniques. En édition, renseignez le mot de passe seulement pour le remplacer.</p>
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
            Matricule
            <input disabled={!canAdmin} inputMode="numeric" pattern="[0-9]*" value={form.matricule || ""} onChange={(event) => setForm((current) => ({ ...current, matricule: event.target.value.replace(/\D/g, "") }))} />
          </label>
          <label>
            Email
            <input autoComplete="email" required disabled={!canAdmin} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Mot de passe
            <input
              autoComplete="new-password"
              required={!editingUser}
              disabled={!canAdmin}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={editingUser ? "Nouveau mot de passe optionnel" : ""}
            />
          </label>
          <label>
            Telephone
            <input autoComplete="tel" required disabled={!canAdmin} inputMode="tel" pattern="\\+?[0-9\\s().-]{8,20}" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
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
          <label className="asset-required-field user-enabled-field">
            <input disabled={!canAdmin} checked={form.enabled} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Compte actif
          </label>
          <fieldset className="user-role-selects">
            <legend>Roles applicatifs</legend>
            {roleRows.map((role, index) => (
              <div className="user-role-select-row" key={`role-${index}`}>
                <label>
                  Role {index + 1}
                  <select required={index === 0} disabled={!canAdmin} value={role} onChange={(event) => updateRoleAt(index, event.target.value)}>
                    <option value="">Selectionner un role</option>
                    {roleOptionsForIndex(index).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                {index > 0 && (
                  <button className="ghost-icon" disabled={!canAdmin} type="button" onClick={() => removeRoleAt(index)} title="Supprimer ce role">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            <button className="secondary-action compact-action" disabled={!canAdmin || roleRows.length >= displayedRoleOptions.length} type="button" onClick={addRoleSlot}>
              <Plus size={15} />
              Ajouter role
            </button>
          </fieldset>
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

function normalizeUserSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function roleOptionKey(value) {
  return normalizeUserSearch(value).replaceAll("_", " ");
}

function dedupeRoleOptions(options = []) {
  const seen = new Set();
  return options.filter((option) => {
    const key = roleOptionKey(option.label || option.value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function userMatchesRoleFilter(user, roleFilter) {
  const filter = roleOptionKey(roleFilter);
  if (!filter) return true;
  return [
    ...parseUserRoles(user?.role),
    userRoleLabel(user?.role),
    user?.jobTitle
  ].filter(Boolean).some((value) => roleOptionKey(value) === filter);
}
