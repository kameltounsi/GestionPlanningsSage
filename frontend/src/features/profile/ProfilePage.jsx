import React from "react";
import { Camera, Save, UserCircle } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { userRoleLabel } from "../../utils/users";

export function ProfilePage({ currentUser, passwordForm, profileForm, saving, onChangePassword, onSubmit, onUploadPhoto, setPasswordForm, setProfileForm }) {
  if (!currentUser) {
    return (
      <section className="page-content">
        <PageHeader eyebrow="Compte" title="Profil" subtitle="Les informations du compte seront disponibles après chargement." />
        <EmptyState title="Profil indisponible" text="Le compte fchelbi n'a pas encore ete charge." />
      </section>
    );
  }

  return (
    <section className="page-content profile-content">
      <PageHeader eyebrow="Compte" title="Mon profil" subtitle="Photo, informations personnelles et changement de mot de passe." />
      <div className="profile-layout">
        <section className="panel profile-card">
          <div className="profile-photo">
            {currentUser.profilePhotoUrl ? <img alt="" src={currentUser.profilePhotoUrl} /> : <UserCircle size={72} />}
          </div>
          <h2>{currentUser.fullName}</h2>
          <span>{currentUser.jobTitle || "Poste non renseigné"}</span>
          <strong className="stage-pill teal">{userRoleLabel(currentUser.role)}</strong>
          <label className="secondary-action compact-action photo-upload">
            <Camera size={15} />
            Photo
            <input accept="image/*" type="file" onChange={(event) => onUploadPhoto(event.target.files?.[0])} />
          </label>
        </section>
        <form className="panel form-page" onSubmit={onSubmit}>
          <div className="form-intro">
            <div>
              <h2>Informations profil</h2>
              <p>Mettez à jour vos coordonnées et votre identification utilisateur.</p>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Nom complet
              <input required value={profileForm.fullName} onChange={(event) => setProfileForm((form) => ({ ...form, fullName: event.target.value }))} />
            </label>
            <label>
              Username
              <input required value={profileForm.username} onChange={(event) => setProfileForm((form) => ({ ...form, username: event.target.value }))} />
            </label>
            <label>
              Poste
              <input value={profileForm.jobTitle} onChange={(event) => setProfileForm((form) => ({ ...form, jobTitle: event.target.value }))} />
            </label>
            <label>
              Email
              <input required type="email" value={profileForm.email} onChange={(event) => setProfileForm((form) => ({ ...form, email: event.target.value }))} />
            </label>
            <label>
              Telephone
              <input value={profileForm.phone} onChange={(event) => setProfileForm((form) => ({ ...form, phone: event.target.value }))} />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-action" disabled={saving} type="submit">
              <Save size={16} />
              Enregistrer profil
            </button>
          </div>
        </form>
        <form className="panel form-page password-panel" onSubmit={onChangePassword}>
          <div className="form-intro">
            <div>
              <h2>Mot de passe</h2>
              <p>Choisissez un nouveau mot de passe pour votre prochain acces.</p>
            </div>
          </div>
          <label>
            Nouveau mot de passe
            <input required type="password" value={passwordForm.password} onChange={(event) => setPasswordForm((form) => ({ ...form, password: event.target.value }))} />
          </label>
          <label>
            Confirmation
            <input required type="password" value={passwordForm.confirmation} onChange={(event) => setPasswordForm((form) => ({ ...form, confirmation: event.target.value }))} />
          </label>
          <div className="button-row">
            <button className="secondary-action" disabled={saving} type="submit">
              <Save size={16} />
              Changer mot de passe
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
