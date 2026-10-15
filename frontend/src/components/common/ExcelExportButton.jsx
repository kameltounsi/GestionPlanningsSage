import React, { useState } from "react";
import { Download } from "lucide-react";
import { downloadExcel } from "../../utils/excelExport";

export function ExcelExportButton({ title, sheets, scope, loadSheets, label = "Exporter Excel", disabled = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function exportFile() {
    setBusy(true);
    setError("");
    try {
      await downloadExcel({ title, sheets: loadSheets ? await loadSheets() : sheets, scope });
    } catch (failure) {
      setError(failure.message || "Impossible de générer le fichier Excel. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return <span className="excel-export-control">
    <button className="secondary-action compact-action excel-export-button" type="button" onClick={exportFile} disabled={disabled || busy} aria-busy={busy} title={scope || `Exporter ${title} au format Excel`}>
      <Download size={16} />{busy ? "Préparation…" : label}
    </button>
    {error && <span role="alert" className="excel-export-error">{error}</span>}
  </span>;
}
