import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import "./ActionDatePicker.css";

const iso = (date) => date.toISOString().slice(0, 10);
const parse = (value) => new Date(`${value}T12:00:00Z`);
const addDays = (value, days) => { const date = parse(value); date.setUTCDate(date.getUTCDate() + days); return iso(date); };
const display = (value) => value ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parse(value)) : "Non définie";

export function ActionDatePicker({ action, saving, onSave }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="action-date-trigger" onClick={() => setOpen(true)} disabled={saving} aria-label={`Modifier la date de début de ${action.title}`}>
      <CalendarDays size={17} /><span>{display(action.startDate)}</span><span className="action-date-edit-label">Modifier</span>
    </button>
    {open && <DateDialog action={action} saving={saving} onSave={onSave} onClose={() => setOpen(false)} />}
  </>;
}

function DateDialog({ action, saving, onSave, onClose }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [selected, setSelected] = useState(action.startDate || today);
  const [month, setMonth] = useState((action.startDate || today).slice(0, 7));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef(null);
  const busy = saving || submitting;
  const duration = Math.max(0, Number(action.workDurationDays ?? 1));
  const first = parse(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => addDays(iso(first), i - offset));
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => previous?.focus();
  }, []);
  function choose(value) {
    if (!value) return;
    setSelected(value);
    setMonth(value.slice(0, 7));
  }
  function moveMonth(delta) {
    const date = parse(`${month}-01`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(iso(date).slice(0, 7));
  }
  async function apply() {
    setSubmitting(true);
    setError("");
    try {
      const result = await onSave(action, action.workDurationDays ?? 1, selected);
      if (result === false) setError("La date n’a pas été enregistrée. Vérifiez les droits et réessayez.");
      else onClose();
    } catch { setError("Impossible d’enregistrer cette date. Réessayez."); }
    finally { setSubmitting(false); }
  }
  return createPortal(<dialog ref={dialog} className="action-date-dialog" aria-labelledby="action-date-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="action-date-dialog-header">
      <div><p>PLANIFICATION DE L’ACTION</p><h2 id="action-date-title">Choisir la date de début</h2></div>
      <button type="button" className="action-date-close" aria-label="Fermer" disabled={busy} onClick={onClose}><X size={20} /></button>
    </header>
    <p className="action-date-title">{action.title}</p>
    <div className="action-date-layout">
      <section className="action-date-calendar" aria-label="Calendrier de sélection">
        <div className="action-date-month">
          <button type="button" aria-label="Mois précédent" onClick={() => moveMonth(-1)} disabled={busy}><ChevronLeft size={19} /></button>
          <strong aria-live="polite">{new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</strong>
          <button type="button" aria-label="Mois suivant" onClick={() => moveMonth(1)} disabled={busy}><ChevronRight size={19} /></button>
        </div>
        <div className="action-date-grid">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <small key={day}>{day}</small>)}
          {days.map((day, index) => <button type="button" key={day} disabled={busy} aria-label={display(day)} aria-pressed={day === selected} aria-current={day === today ? "date" : undefined}
            className={[day.slice(0, 7) !== month ? "outside" : "", index % 7 >= 5 ? "weekend" : "", day === selected ? "selected" : "", day === today ? "today" : ""].join(" ")}
            onClick={() => choose(day)}>{parse(day).getUTCDate()}</button>)}
        </div>
        <div className="action-date-shortcuts"><button type="button" disabled={busy} onClick={() => choose(today)}>Aujourd’hui</button><button type="button" disabled={busy} onClick={() => choose(addDays(today, 7))}>Dans 7 jours</button></div>
      </section>
      <section className="action-date-preview" aria-label="Aperçu du planning">
        <label>Date choisie<input type="date" value={selected} disabled={busy} onChange={(event) => choose(event.target.value)} /></label>
        <dl><div><dt>Début actuel</dt><dd>{display(action.startDate)}</dd></div><div><dt>Durée conservée</dt><dd>{duration} jour{duration > 1 ? "s" : ""}</dd></div><div className="new-end"><dt>Nouvelle date de fin</dt><dd>{display(addDays(selected, duration))}</dd></div></dl>
        <p>{action.routineAction ? "Seules les dates de cette action de routine seront modifiées." : "Les actions dépendantes non terminées et les phases suivantes seront recalculées. Les actions terminées conservent leurs dates."}</p>
        <p className="action-date-note">Calcul en jours calendaires, week-ends compris.</p>
      </section>
    </div>
    {error && <p role="alert" className="action-date-error">{error}</p>}
    <footer className="action-date-footer"><button type="button" className="secondary-action" disabled={busy} onClick={onClose}>Annuler</button><button type="button" className="primary-action" disabled={busy || selected === action.startDate} onClick={apply}>{busy ? "Enregistrement…" : "Appliquer la date"}</button></footer>
  </dialog>, document.body);
}
