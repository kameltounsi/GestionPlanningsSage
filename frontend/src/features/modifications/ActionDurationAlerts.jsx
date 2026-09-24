import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { acknowledgeActionDurationAlerts, getPendingActionDurationAlerts } from "../../api";
import "./ActionDurationAlerts.css";

export function ActionDurationAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [closing, setClosing] = useState(null);
  const [error, setError] = useState("");
  const [soundBlocked, setSoundBlocked] = useState(false);
  const acknowledged = useRef(new Set());
  const dialogRef = useRef(null);
  const audioRef = useRef(null);
  const active = alerts.length > 0;

  useEffect(() => {
    let disposed = false;
    let loading = false;
    let refreshAgain = false;
    const refresh = async () => {
      if (loading) { refreshAgain = true; return; }
      loading = true;
      try {
        const items = await getPendingActionDurationAlerts();
        if (!disposed && Array.isArray(items)) {
          // Keep displayed alerts until their explicit close request succeeds.
          setAlerts(previous => [...new Map([...previous, ...items]
            .filter(item => !acknowledged.current.has(item.id)).map(item => [item.id, item])).values()]);
        }
      } catch { /* Retain pending alerts during network outages. */ }
      finally {
        loading = false;
        if (!disposed && refreshAgain) { refreshAgain = false; refresh(); }
      }
    };
    refresh();
    const timer = globalThis.setInterval(refresh, 3000);
    globalThis.addEventListener("action-duration-alerts-refresh", refresh);
    globalThis.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      globalThis.clearInterval(timer);
      globalThis.removeEventListener("action-duration-alerts-refresh", refresh);
      globalThis.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    let disposed = false;
    const preventDismiss = event => event.preventDefault();
    const preventEscape = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const keepOpen = () => { if (!disposed && !dialog.open) dialog.showModal(); };
    dialog.addEventListener("cancel", preventDismiss);
    dialog.addEventListener("keydown", preventEscape, true);
    dialog.addEventListener("close", keepOpen);
    dialog.showModal();
    const audio = new Audio("/notif.mp3");
    audio.loop = true;
    audio.volume = 0.65;
    audioRef.current = audio;
    const play = () => audio.play().then(() => {
      if (!disposed) setSoundBlocked(false);
    }).catch(() => { if (!disposed) setSoundBlocked(true); });
    play();
    document.addEventListener("pointerdown", play);
    document.addEventListener("keydown", play);
    return () => {
      disposed = true;
      dialog.removeEventListener("cancel", preventDismiss);
      dialog.removeEventListener("keydown", preventEscape, true);
      dialog.removeEventListener("close", keepOpen);
      document.removeEventListener("pointerdown", play);
      document.removeEventListener("keydown", play);
      audio.pause();
      audioRef.current = null;
      dialog.close();
      previousFocus?.focus();
    };
  }, [active]);

  async function closeAlert(id) {
    setClosing(id);
    setError("");
    try {
      await acknowledgeActionDurationAlerts([id]);
      acknowledged.current.add(id);
      setAlerts(previous => previous.filter(alert => alert.id !== id));
    } catch {
      setError("Fermeture non enregistrée. Vérifiez la connexion puis réessayez.");
    } finally { setClosing(null); }
  }

  if (!active) return null;
  return createPortal(
    <dialog ref={dialogRef} className="action-duration-alert-dialog" aria-labelledby="duration-alert-title"
      onCancel={event => event.preventDefault()}>
      <h2 id="duration-alert-title">Action critique : durée modifiée</h2>
      <p>Vous êtes le validateur. Cette alerte reste affichée jusqu’à sa fermeture.</p>
      {soundBlocked && <button type="button" className="secondary-action" onClick={() => {
        audioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
      }}>Activer le son</button>}
      <div className="action-duration-alert-list">
        {alerts.map(alert => <article key={alert.id}>
          <h3>{alert.actionTitle || "Action"}</h3>
          <p>Modification : <strong>{alert.requestLabel || `#${alert.requestId}`}</strong></p>
          <p><strong>{alert.changedBy || "Le chef de projet"}</strong> a changé la durée de <strong>{alert.previousDays} jour(s)</strong> à <strong>{alert.newDays} jour(s)</strong>.</p>
          <button autoFocus={alert.id === alerts[0].id} className="primary-action" type="button"
            disabled={closing !== null} onClick={() => closeAlert(alert.id)}>
            {closing === alert.id ? "Fermeture…" : "Fermer"}
          </button>
        </article>)}
      </div>
      {error && <p role="alert">{error}</p>}
    </dialog>, document.body
  );
}
