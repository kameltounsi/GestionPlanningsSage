import React from "react";
import { CircleAlert, Lock, Mail } from "lucide-react";

export function LoginPage({ error, form, saving, onSubmit, setForm }) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <img className="login-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" />
          <div>
            <p className="eyebrow">Sage Plannings</p>
            <h1>Connexion</h1>
            <span>Acces securise a l'application ECR</span>
          </div>
        </div>
        {error && (
          <div className="banner login-banner">
            <CircleAlert size={18} />
            {error}
          </div>
        )}
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <span className="input-with-icon">
              <Mail size={16} />
              <input
                autoComplete="email"
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="f.chalbi@sagetunisia.com"
              />
            </span>
          </label>
          <label>
            Mot de passe
            <span className="input-with-icon">
              <Lock size={16} />
              <input
                autoComplete="current-password"
                required
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Votre mot de passe"
              />
            </span>
          </label>
          <button className="primary-action wide-action" disabled={saving} type="submit">
            <Lock size={16} />
            Se connecter
          </button>
        </form>
      </section>
    </main>
  );
}
