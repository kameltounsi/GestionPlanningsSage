import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { emptyFinishedProductForm } from "../../constants/forms";
import { userRoleLabel } from "../../utils/users";

const PREFERENTIAL_PAGE_SIZE = 5;

function normalizeRoleToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function hasApplicationRole(user, code, label) {
  const role = normalizeRoleToken(user?.role);
  return role === normalizeRoleToken(code) || role === normalizeRoleToken(label);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function includeCurrentOption(options, currentValue) {
  if (!currentValue || options.includes(currentValue)) {
    return options;
  }
  return uniqueSorted([...options, currentValue]);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseProjectTeam(projectTeam) {
  return String(projectTeam || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function findUserByTeamName(userName, users = []) {
  return users.find((user) => [user.fullName, user.username, user.email].filter(Boolean).includes(userName));
}

function formatUserWithRole(userName, users = []) {
  const user = findUserByTeamName(userName, users);
  return user ? `${userName} (${userRoleLabel(user.role)})` : userName;
}

function formatProjectTeamWithRoles(projectTeam, users = []) {
  const members = parseProjectTeam(projectTeam);
  if (members.length === 0) return "Equipe non renseignee";
  return members.map((member) => formatUserWithRole(member, users)).join(", ");
}

function userDisplayRole(user) {
  return userRoleLabel(user?.role);
}

function isProjectLead(user) {
  return hasApplicationRole(user, "CHEF_DE_PROJET", "Chef de projet");
}

function selectedProjectLeadNames(users = []) {
  return users
    .filter(isProjectLead)
    .map((user) => user.fullName || user.username || user.email)
    .filter(Boolean);
}

function countSelectedProjectLeads(projectTeam, users = []) {
  const selectedNames = parseProjectTeam(projectTeam);
  return selectedProjectLeadNames(users).filter((name) => selectedNames.includes(name)).length;
}

function ProjectTeamSelector({ projectTeam, users = [], onChange }) {
  const [teamQuery, setTeamQuery] = useState("");
  const selectedNames = useMemo(() => parseProjectTeam(projectTeam), [projectTeam]);
  const selectedProjectLeadCount = useMemo(() => countSelectedProjectLeads(projectTeam, users), [projectTeam, users]);
  const normalizedQuery = normalizeSearchText(teamQuery);
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""))),
    [users]
  );
  const filteredUsers = sortedUsers.filter((user) => {
    if (!normalizedQuery) return true;
    return [user.fullName, user.username, user.email, user.jobTitle, userRoleLabel(user.role)]
      .filter(Boolean)
      .some((value) => normalizeSearchText(value).includes(normalizedQuery));
  });

  function toggleUser(user, checked) {
    const userName = user.fullName || user.username || user.email;
    const nextNames = checked
      ? [...selectedNames.filter((name) => !isProjectLead(user) || !selectedProjectLeadNames(users).includes(name)), userName]
      : selectedNames.filter((name) => name !== userName);
    onChange([...new Set(nextNames)].join(", "));
  }

  return (
    <fieldset className="project-team-field">
      <legend>Equipe projet</legend>
      <div className="search project-team-search">
        <Search size={16} />
        <input
          placeholder="Rechercher un utilisateur"
          value={teamQuery}
          onChange={(event) => setTeamQuery(event.target.value)}
        />
      </div>
      <div className="project-team-list">
        {filteredUsers.length === 0 ? (
          <p className="form-hint">Aucun utilisateur trouve.</p>
        ) : (
          filteredUsers.map((user) => {
            const userName = user.fullName || user.username || user.email;
            const checked = selectedNames.includes(userName);
            return (
              <label className="project-team-option" key={user.id || userName}>
                <input
                  checked={checked}
                  type="checkbox"
                  onChange={(event) => toggleUser(user, event.target.checked)}
                />
                <span>
                  <strong>{userName}</strong>
                  <small>{userDisplayRole(user)}</small>
                </span>
              </label>
            );
          })
        )}
      </div>
      <p className={selectedProjectLeadCount === 1 ? "form-hint" : "form-hint project-team-warning"}>
        {selectedNames.length} utilisateur{selectedNames.length > 1 ? "s" : ""} selectionne{selectedNames.length > 1 ? "s" : ""}.
        {" "}Chef de projet: {selectedProjectLeadCount}/1
      </p>
    </fieldset>
  );
}

function useFilteredItems(items, searchTerm, getValues) {
  return useMemo(() => {
    const normalized = normalizeSearchText(searchTerm);
    if (!normalized) return items;

    return items.filter((item) => getValues(item)
      .filter(Boolean)
      .some((value) => normalizeSearchText(value).includes(normalized)));
  }, [getValues, items, searchTerm]);
}

function usePaginatedItems(items, pageSize) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const boundedPage = Math.min(currentPage, pageCount);

  useEffect(() => {
    if (currentPage !== boundedPage) {
      setCurrentPage(boundedPage);
    }
  }, [boundedPage, currentPage]);

  const pagedItems = useMemo(() => {
    const start = (boundedPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [boundedPage, items, pageSize]);

  return { currentPage: boundedPage, pageCount, pagedItems, setCurrentPage };
}

function PaginationControls({ currentPage, pageCount, totalCount, onPageChange }) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span>Page {currentPage} / {pageCount} - {totalCount} elements</span>
      <div className="pagination-actions">
        <button className="ghost-icon" disabled={currentPage <= 1} type="button" onClick={() => onPageChange(currentPage - 1)} title="Page precedente" aria-label="Page precedente">
          <ChevronLeft size={16} />
        </button>
        <button className="ghost-icon" disabled={currentPage >= pageCount} type="button" onClick={() => onPageChange(currentPage + 1)} title="Page suivante" aria-label="Page suivante">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

export function PreferentialsPage({
  clientForm,
  clients,
  editingClient,
  editingFinishedProduct,
  editingProduct,
  editingProject,
  editingRole,
  finishedProductForm,
  finishedProducts,
  productForm,
  products,
  projectForm,
  projects,
  roleForm,
  roles,
  saving,
  users,
  onCancelClientEdit,
  onCancelFinishedProductEdit,
  onCancelProductEdit,
  onCancelProjectEdit,
  onCancelRoleEdit,
  onDeleteClient,
  onDeleteFinishedProduct,
  onDeleteProduct,
  onDeleteProject,
  onDeleteRole,
  onEditClient,
  onEditFinishedProduct,
  onEditProduct,
  onEditProject,
  onEditRole,
  onImportFinishedProducts,
  onSubmitClient,
  onSubmitFinishedProduct,
  onSubmitProduct,
  onSubmitProject,
  onSubmitRole,
  setClientForm,
  setFinishedProductForm,
  setProductForm,
  setProjectForm,
  setRoleForm
}) {
  const [activePreferential, setActivePreferential] = useState("projects");
  const preferentialEntities = [
    { key: "projects", label: "Projets", count: projects.length },
    { key: "clients", label: "Clients", count: clients.length },
    { key: "products", label: "Produits", count: products.length },
    { key: "finished-products", label: "Produits finis", count: finishedProducts.length },
    { key: "roles", label: "Rôles d'action", count: roles.length }
  ];

  return (
    <section className="page-content">
      <PageHeader eyebrow="Référentiel" title="Préférentiels" subtitle="Gérez les projets, clients, produits et rôles d'action utilisés dans les modifications." />
      <div className="preferentials-layout">
        <aside className="panel preferential-entity-list" aria-label="Entites du referentiel">
          {preferentialEntities.map((entity) => (
            <button
              className={activePreferential === entity.key ? "preferential-entity-button active" : "preferential-entity-button"}
              key={entity.key}
              type="button"
              onClick={() => setActivePreferential(entity.key)}
            >
              <span>{entity.label}</span>
              <strong>{entity.count}</strong>
            </button>
          ))}
        </aside>
        <div className="preferential-entity-content">
          {activePreferential === "projects" && (
      <ProjectPreferentialPanel
        editingProject={editingProject}
        projectForm={projectForm}
        projects={projects}
        saving={saving}
        users={users}
        onCancelEdit={onCancelProjectEdit}
        onDelete={onDeleteProject}
        onEdit={onEditProject}
        onSubmit={onSubmitProject}
        setProjectForm={setProjectForm}
      />
          )}
          {activePreferential === "clients" && (
        <PreferentialPanel
          count={clients.length}
          editing={editingClient}
          emptyText="Ajoutez les clients disponibles pour la création des modifications."
          emptyTitle="Aucun client"
          form={clientForm}
          saving={saving}
          title="Clients"
          onCancelEdit={onCancelClientEdit}
          onDelete={onDeleteClient}
          onEdit={onEditClient}
          onSubmit={onSubmitClient}
          references={clients}
          setForm={setClientForm}
        />
          )}
          {activePreferential === "products" && (
        <PreferentialPanel
          count={products.length}
          editing={editingProduct}
          emptyText="Ajoutez les produits disponibles pour la création des modifications."
          emptyTitle="Aucun produit"
          form={productForm}
          saving={saving}
          title="Produits"
          onCancelEdit={onCancelProductEdit}
          onDelete={onDeleteProduct}
          onEdit={onEditProduct}
          onSubmit={onSubmitProduct}
          references={products}
          setForm={setProductForm}
        />
          )}
          {activePreferential === "finished-products" && (
        <FinishedProductPreferentialPanel
          clients={clients}
          editing={editingFinishedProduct}
          form={finishedProductForm}
          products={products}
          projects={projects}
          references={finishedProducts}
          saving={saving}
          onCancelEdit={onCancelFinishedProductEdit}
          onDelete={onDeleteFinishedProduct}
          onEdit={onEditFinishedProduct}
          onImport={onImportFinishedProducts}
          onSubmit={onSubmitFinishedProduct}
          setForm={setFinishedProductForm}
        />
          )}
          {activePreferential === "roles" && (
        <PreferentialPanel
          count={roles.length}
          editing={editingRole}
          emptyText="Ajoutez les rôles disponibles uniquement comme pilotes d'action."
          emptyTitle="Aucun rôle"
          form={roleForm}
          saving={saving}
          title="Rôles d'action"
          onCancelEdit={onCancelRoleEdit}
          onDelete={onDeleteRole}
          onEdit={onEditRole}
          onSubmit={onSubmitRole}
          references={roles}
          setForm={setRoleForm}
        />
          )}
        </div>
      </div>
    </section>
  );
}


function FinishedProductPreferentialPanel({ clients = [], editing, form, products, projects, references, saving, onCancelEdit, onDelete, onEdit, onImport, onSubmit, setForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const importInputRef = useRef(null);
  const clientNames = uniqueSorted(clients.map((client) => client.name));
  const projectNames = uniqueSorted(projects.map((project) => project.name));
  const productNames = uniqueSorted(products.map((product) => product.name));
  const filteredReferences = useFilteredItems(references, searchTerm, (reference) => [
    reference.client,
    reference.project,
    reference.partNumber,
    reference.designation,
    reference.customerPn,
    reference.product,
    reference.coiffeIndex,
    reference.drawingIndex,
    reference.reducedCode,
    reference.comments
  ]);
  const { currentPage, pageCount, pagedItems, setCurrentPage } = usePaginatedItems(filteredReferences, PREFERENTIAL_PAGE_SIZE);

  useEffect(() => {
    if (editing) {
      setDialogOpen(true);
    }
  }, [editing]);

  function openCreateDialog() {
    onCancelEdit();
    setForm(emptyFinishedProductForm);
    setDialogOpen(true);
  }

  function closeDialog() {
    onCancelEdit();
    setDialogOpen(false);
  }

  function submitDialog(event) {
    const result = onSubmit(event);
    if (!result?.then) return result;
    return result
      .then(() => setDialogOpen(false))
      .catch(() => {});
  }

  function handleImportChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const importResult = onImport?.(file);
    if (importResult?.finally) {
      importResult.finally(() => {
        event.target.value = "";
      });
    } else {
      event.target.value = "";
    }
  }

  return (
    <section className="panel preferential-panel">
      <div className="section-title">
        <div>
          <h2>Produits finis</h2>
          <span>{references.length} element{references.length > 1 ? "s" : ""}</span>
        </div>
        <div className="row-actions">
          <button className="secondary-action compact-action" disabled={saving} type="button" onClick={() => importInputRef.current?.click()}>
            <Upload size={16} />
            Importer Excel
          </button>
          <input ref={importInputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleImportChange} />
          <button className="primary-action compact-action" disabled={saving || clientNames.length === 0 || projectNames.length === 0 || productNames.length === 0} type="button" onClick={openCreateDialog}>
            <Plus size={15} />
            Ajouter
          </button>
        </div>
      </div>
      {clientNames.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un client.</p>}
      {projectNames.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un projet.</p>}
      {productNames.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un produit.</p>}
      <label className="preferential-search">
        Rechercher
        <div className="input-with-icon">
          <Search size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher dans les produits finis" />
        </div>
      </label>
      <div className="table-list">
        {references.length === 0 ? (
          <EmptyState title="Aucun produit fini" text="Ajoutez les produits finis par projet et produit." compact />
        ) : filteredReferences.length === 0 ? (
          <EmptyState title="Aucun resultat" text="Essayez un autre terme de recherche." compact />
        ) : (
          <>
            {pagedItems.map((reference) => (
              <article className="project-table-row preferential-table-row finished-product-row" key={reference.id}>
                <div>
                  <strong>{reference.partNumber}</strong>
                  <span>{reference.project} | {reference.product} | Code reduit: {reference.reducedCode}</span>
                  <small>{[reference.client, reference.designation, reference.customerPn].filter(Boolean).join(" | ") || "Details non renseignes"}</small>
                </div>
                <div className="finished-product-meta">
                  <span>{reference.salePrice != null ? String(reference.salePrice) + " EUR" : "-"}</span>
                  <span>{reference.productionIntegrationDate || "-"}</span>
                </div>
                <div className="row-actions">
                  <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => onEdit(reference)} aria-label={"Modifier " + reference.partNumber} title="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button className="ghost-icon" type="button" onClick={() => onDelete(reference.id)} title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              totalCount={filteredReferences.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
      {dialogOpen && (
        <FinishedProductDialog
          clientNames={clientNames}
          editing={editing}
          form={form}
          productNames={productNames}
          projectNames={projectNames}
          saving={saving}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setForm}
        />
      )}
    </section>
  );
}

function FinishedProductDialog({ clientNames, editing, form, productNames, projectNames, saving, onClose, onSubmit, setForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="finished-product-dialog-title"
        aria-modal="true"
        className="dialog-card finished-product-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Produit fini</p>
            <h2 id="finished-product-dialog-title">{editing ? "Modifier le produit fini" : "Ajouter un produit fini"}</h2>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="finished-product-grid">
          <label>
            Client
            <select required value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}>
              <option value="">Selectionner un client</option>
              {includeCurrentOption(clientNames, form.client).map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
          </label>
          <label>
            Projet
            <select required value={form.project} onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))}>
              <option value="">Selectionner un projet</option>
              {includeCurrentOption(projectNames, form.project).map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
          </label>
          <label>
            Part number
            <input required value={form.partNumber} onChange={(event) => setForm((current) => ({ ...current, partNumber: event.target.value }))} />
          </label>
          <label>
            Designation
            <input value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
          </label>
          <label>
            Customer PN
            <input value={form.customerPn} onChange={(event) => setForm((current) => ({ ...current, customerPn: event.target.value }))} />
          </label>
          <label>
            Produit
            <select required value={form.product} onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))}>
              <option value="">Selectionner un produit</option>
              {includeCurrentOption(productNames, form.product).map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </label>
          <label>
            Indice coiffe
            <input value={form.coiffeIndex} onChange={(event) => setForm((current) => ({ ...current, coiffeIndex: event.target.value }))} />
          </label>
          <label>
            Indice drawing
            <input value={form.drawingIndex} onChange={(event) => setForm((current) => ({ ...current, drawingIndex: event.target.value }))} />
          </label>
          <label>
            Code reduit
            <input required value={form.reducedCode} onChange={(event) => setForm((current) => ({ ...current, reducedCode: event.target.value }))} />
          </label>
          <label>
            Prix vente
            <input min="0" step="0.001" type="number" value={form.salePrice} onChange={(event) => setForm((current) => ({ ...current, salePrice: event.target.value }))} />
          </label>
          <label>
            Date integration production
            <input type="date" value={form.productionIntegrationDate} onChange={(event) => setForm((current) => ({ ...current, productionIntegrationDate: event.target.value }))} />
          </label>
          <label className="finished-product-comments">
            Commentaires
            <textarea value={form.comments} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

function PreferentialPanel({ count, editing, emptyText, emptyTitle, form, references, saving, title, onCancelEdit, onDelete, onEdit, onSubmit, setForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const filteredReferences = useFilteredItems(references, searchTerm, (reference) => [reference.name]);
  const { currentPage, pageCount, pagedItems, setCurrentPage } = usePaginatedItems(filteredReferences, PREFERENTIAL_PAGE_SIZE);

  useEffect(() => {
    if (editing) {
      setDialogOpen(true);
    }
  }, [editing]);

  function openCreateDialog() {
    onCancelEdit();
    setForm({ name: "" });
    setDialogOpen(true);
  }

  function closeDialog() {
    onCancelEdit();
    setDialogOpen(false);
  }

  function submitDialog(event) {
    const result = onSubmit(event);
    if (!result?.then) return result;
    return result
      .then(() => setDialogOpen(false))
      .catch(() => {});
  }

  return (
    <section className="panel preferential-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{count} element{count > 1 ? "s" : ""}</span>
        </div>
        <button className="primary-action compact-action" disabled={saving} type="button" onClick={openCreateDialog}>
          <Plus size={15} />
          Ajouter
        </button>
      </div>
      <label className="preferential-search">
        Rechercher
        <div className="input-with-icon">
          <Search size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={"Rechercher dans " + title.toLowerCase()} />
        </div>
      </label>
      <div className="table-list">
        {references.length === 0 ? (
          <EmptyState title={emptyTitle} text={emptyText} compact />
        ) : filteredReferences.length === 0 ? (
          <EmptyState title="Aucun resultat" text="Essayez un autre terme de recherche." compact />
        ) : (
          <>
            {pagedItems.map((reference) => (
              <article className="project-table-row preferential-table-row" key={reference.id}>
                <div>
                  <strong>{reference.name}</strong>
                </div>
                <div className="row-actions">
                  <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => onEdit(reference)} aria-label={"Modifier " + reference.name} title="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button className="ghost-icon" type="button" onClick={() => onDelete(reference.id)} title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              totalCount={filteredReferences.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
      {dialogOpen && (
        <PreferentialDialog
          editing={editing}
          form={form}
          saving={saving}
          title={title}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setForm}
        />
      )}
    </section>
  );
}

function PreferentialDialog({ editing, form, saving, title, onClose, onSubmit, setForm }) {
  const singularTitle = title.endsWith("s") ? title.slice(0, -1) : title;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="preferential-dialog-title"
        aria-modal="true"
        className="dialog-card preferential-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Referentiel</p>
            <h2 id="preferential-dialog-title">{editing ? "Modifier " + singularTitle.toLowerCase() : "Ajouter " + singularTitle.toLowerCase()}</h2>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <label>
          Nom
          <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <div className="button-row">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

function ProjectPreferentialPanel({ editingProject, projectForm, projects, saving, users, onCancelEdit, onDelete, onEdit, onSubmit, setProjectForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const filteredProjects = useFilteredItems(projects, searchTerm, (project) => [
    project.name,
    project.projectTeam,
    formatProjectTeamWithRoles(project.projectTeam, users)
  ]);
  const { currentPage, pageCount, pagedItems, setCurrentPage } = usePaginatedItems(filteredProjects, PREFERENTIAL_PAGE_SIZE);

  useEffect(() => {
    if (editingProject) {
      setDialogOpen(true);
    }
  }, [editingProject]);

  function openCreateDialog() {
    onCancelEdit();
    setDialogOpen(true);
  }

  function closeDialog() {
    onCancelEdit();
    setDialogOpen(false);
  }

  function submitDialog(event) {
    const result = onSubmit(event);
    if (!result?.then) return result;
    return result
      .then(() => setDialogOpen(false))
      .catch(() => {});
  }

  return (
    <section className="panel project-preferential-panel">
      <div className="section-title">
        <div>
          <h2>Projets</h2>
          <span>{projects.length} projet{projects.length > 1 ? "s" : ""}</span>
        </div>
        <button className="primary-action compact-action" disabled={saving} type="button" onClick={openCreateDialog}>
          <Plus size={15} />
          Ajouter
        </button>
      </div>
      <label className="preferential-search">
        Rechercher
        <div className="input-with-icon">
          <Search size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher dans projets" />
        </div>
      </label>
      <div className="table-list">
        {projects.length === 0 ? (
          <EmptyState title="Aucun projet créé" text="Ajoutez un premier projet pour débloquer la création des modifications." compact />
        ) : filteredProjects.length === 0 ? (
          <EmptyState title="Aucun resultat" text="Essayez un nom de projet ou un membre d'equipe." compact />
        ) : (
          <>
            {pagedItems.map((project) => (
              <article className="project-table-row" key={project.name}>
                <div>
                  <strong>{project.name}</strong>
                  <span className="project-team-list">{formatProjectTeamWithRoles(project.projectTeam, users)}</span>
                </div>
                <div className="row-actions">
                  <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => onEdit(project)} aria-label="Modifier le projet" title="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button className="ghost-icon" type="button" onClick={() => onDelete(project.name)} title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              totalCount={filteredProjects.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
      {dialogOpen && (
        <ProjectDialog
          editingProject={editingProject}
          projectForm={projectForm}
          saving={saving}
          users={users}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setProjectForm={setProjectForm}
        />
      )}
    </section>
  );
}

function ProjectDialog({ editingProject, projectForm, saving, users, onClose, onSubmit, setProjectForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="project-dialog-title"
        aria-modal="true"
        className="dialog-card project-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Projet</p>
            <h2 id="project-dialog-title">{editingProject ? "Modifier le projet" : "Ajouter un projet"}</h2>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <label>
          Nom du projet
          <input disabled={Boolean(editingProject)} required value={projectForm.name} onChange={(event) => setProjectForm((form) => ({ ...form, name: event.target.value }))} />
        </label>
        <ProjectTeamSelector
          projectTeam={projectForm.projectTeam}
          users={users}
          onChange={(projectTeam) => setProjectForm((form) => ({ ...form, projectTeam }))}
        />
        <div className="button-row">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}
