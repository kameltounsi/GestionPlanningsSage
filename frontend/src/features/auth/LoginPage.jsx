import React, { useRef } from "react";
import { CircleAlert, Lock, Mail, RotateCcw, ShieldCheck } from "lucide-react";

export function LoginPage({
  error,
  form,
  passwordResetCode,
  passwordResetEmail,
  passwordResetForm,
  passwordResetStep,
  saving,
  onBackToLogin,
  onConfirmPasswordReset,
  onRequestPasswordReset,
  onResendPasswordResetCode,
  onShowForgotPassword,
  onSubmit,
  onVerifyPasswordResetCode,
  setForm,
  setPasswordResetCode,
  setPasswordResetEmail,
  setPasswordResetForm
}) {
  const codeRefs = useRef([]);

  function updateCode(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setPasswordResetCode((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) {
      codeRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index, event) {
    if (event.key === "Backspace" && !passwordResetCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  const resetTitle = passwordResetStep === "email"
    ? "Mot de passe oublié"
    : passwordResetStep === "code"
      ? "Code de verification"
      : "Nouveau mot de passe";

  return (
    <main className="login-scréén">
      <section className="login-panel">
        <div className="login-brand">
          <img className="login-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" />
          <div>
            <p className="eyebrow">Sage Plannings</p>
            <h1>{passwordResetStep === "login" ? "Connexion" : resetTitle}</h1>
            <span>{passwordResetStep === "login" ? "Accès sécurisé a l'application ECR" : "Récupération sécurisée du compte"}</span>
          </div>
        </div>
        {error && (
          <div className="banner login-banner">
            <CircleAlert size={18} />
            {error}
          </div>
        )}
        {passwordResetStep === "login" && (
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
            <button className="link-action" disabled={saving} type="button" onClick={onShowForgotPassword}>
              Mot de passe oublié ?
            </button>
          </form>
        )}
        {passwordResetStep === "email" && (
          <form className="login-form" onSubmit={onRequestPasswordReset}>
            <p className="form-hint">Saisissez votre email. Un code de 4 chiffres vous sera envoyé.</p>
            <label>
              Email
              <span className="input-with-icon">
                <Mail size={16} />
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={passwordResetEmail}
                  onChange={(event) => setPasswordResetEmail(event.target.value)}
                  placeholder="votre.email@sagetunisia.com"
                />
              </span>
            </label>
            <button className="primary-action wide-action" disabled={saving} type="submit">
              <Mail size={16} />
              Envoyer le code
            </button>
            <button className="secondary-action wide-action" disabled={saving} type="button" onClick={onBackToLogin}>
              Retour connexion
            </button>
          </form>
        )}
        {passwordResetStep === "code" && (
          <form className="login-form" onSubmit={onVerifyPasswordResetCode}>
            <p className="form-hint">Entrez le code reçu par email.</p>
            <div className="reset-code-grid">
              {passwordResetCode.map((digit, index) => (
                <input
                  key={index}
                  aria-label={`Chiffre ${index + 1}`}
                  inputMode="numeric"
                  maxLength={1}
                  ref={(element) => {
                    codeRefs.current[index] = element;
                  }}
                  value={digit}
                  onChange={(event) => updateCode(index, event.target.value)}
                  onKeyDown={(event) => handleCodeKeyDown(index, event)}
                />
              ))}
            </div>
            <button className="primary-action wide-action" disabled={saving} type="submit">
              <ShieldCheck size={16} />
              Vérifier
            </button>
            <button className="secondary-action wide-action" disabled={saving} type="button" onClick={onResendPasswordResetCode}>
              <RotateCcw size={16} />
              Renvoyér le code
            </button>
            <button className="link-action" disabled={saving} type="button" onClick={onBackToLogin}>
              Retour connexion
            </button>
          </form>
        )}
        {passwordResetStep === "password" && (
          <form className="login-form" onSubmit={onConfirmPasswordReset}>
            <label>
              Nouveau mot de passe
              <span className="input-with-icon">
                <Lock size={16} />
                <input
                  autoComplete="new-password"
                  required
                  type="password"
                  value={passwordResetForm.password}
                  onChange={(event) => setPasswordResetForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Nouveau mot de passe"
                />
              </span>
            </label>
            <label>
              Confirmer
              <span className="input-with-icon">
                <Lock size={16} />
                <input
                  autoComplete="new-password"
                  required
                  type="password"
                  value={passwordResetForm.confirmation}
                  onChange={(event) => setPasswordResetForm((current) => ({ ...current, confirmation: event.target.value }))}
                  placeholder="Confirmer le mot de passe"
                />
              </span>
            </label>
            <button className="primary-action wide-action" disabled={saving} type="submit">
              <Lock size={16} />
              Changer le mot de passe
            </button>
            <button className="link-action" disabled={saving} type="button" onClick={onBackToLogin}>
              Retour connexion
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
