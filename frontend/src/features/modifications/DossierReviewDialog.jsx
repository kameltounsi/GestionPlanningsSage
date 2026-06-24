import React, { useEffect, useRef, useState } from "react";
import { FileText, Save, Trash2, Upload, X } from "lucide-react";
import {
  deleteEcrDocument,
  ecrDocumentDownloadUrl,
  getEcrDocuments,
  uploadEcrDocument
} from "../../api";
import {
  dossierReviewExportExcel,
  dossierReviewExportText,
  dossierReviewMetaLine,
  dossierReviewPdfHtml,
  fileNameToken,
  withDossierReviewAssets
} from "./dossierReviewExports";

function requestDisplayName(request) {
  return request?.modificationNumber || request?.client || request?.product || "Modification sans reference";
}

export function DossierReviewDialog({
  canExport,
  canManage,
  downloadBlobFile,
  downloadHtmlAsPdf,
  downloadTextFile,
  errorAlert,
  formatFileSize,
  request,
  saving,
  successToast,
  onClose,
  onSubmit
}) {
  const [value, setValue] = useState(request.dossierReview || "");
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsSaving, setDocumentsSaving] = useState(false);
  const documentInputRef = useRef(null);
  const fileBaseName = `revue-dossier-${fileNameToken(requestDisplayName(request))}`;
  const requestWithAssets = withDossierReviewAssets(request, documents);

  useEffect(() => {
    let disposed = false;
    setDocumentsLoading(true);
    getEcrDocuments(request.id)
      .then((items) => {
        if (!disposed) setDocuments(items);
      })
      .catch(() => {
        if (!disposed) {
          setDocuments([]);
          errorAlert("Chargement des assets revue dossier impossible.");
        }
      })
      .finally(() => {
        if (!disposed) setDocumentsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [errorAlert, request.id]);

  function submit(event) {
    event.preventDefault();
    if (!canManage) {
      onClose();
      return;
    }
    onSubmit(value).then(() => onClose()).catch(() => {});
  }

  function exportTxt() {
    if (!canExport) return;
    downloadTextFile(`${fileBaseName}.txt`, dossierReviewExportText(requestWithAssets, value));
  }

  function exportExcel() {
    if (!canExport) return;
    downloadBlobFile(
      `${fileBaseName}.xls`,
      dossierReviewExportExcel(requestWithAssets, value),
      "application/vnd.ms-excel;charset=utf-8"
    );
    successToast("Revue dossier Excel generee");
  }

  async function exportPdf() {
    if (!canExport) return;
    try {
      await downloadHtmlAsPdf(`${fileBaseName}.pdf`, dossierReviewPdfHtml(requestWithAssets, value), {
        orientation: "portrait",
        width: "900px",
        backgroundColor: "#f7f9f1"
      });
      successToast("Revue dossier PDF telechargee");
    } catch {
      errorAlert("Generation de la revue dossier PDF impossible.");
    }
  }

  function handleUploadDocuments(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !canManage) return;
    setDocumentsSaving(true);
    Promise.all(files.map((file) => uploadEcrDocument(request.id, file, "")))
      .then((uploadedDocuments) => {
        setDocuments((items) => [...uploadedDocuments, ...items]);
        successToast(files.length > 1 ? "Assets ajoutes" : "Asset ajoute");
      })
      .catch(() => {
        errorAlert("Ajout des assets impossible.");
      })
      .finally(() => {
        setDocumentsSaving(false);
        if (documentInputRef.current) {
          documentInputRef.current.value = "";
        }
      });
  }

  function handleDeleteDocument(documentId) {
    if (!canManage || !documentId) return;
    deleteEcrDocument(documentId)
      .then(() => {
        setDocuments((items) => items.filter((item) => item.id !== documentId));
        successToast("Asset supprime");
      })
      .catch(() => errorAlert("Suppression de l'asset impossible."));
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="dossier-review-title"
        aria-modal="true"
        className="dossier-review-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <header className="actions-dialog-header">
          <div>
            <p className="eyebrow">{canManage ? "Document modifiable" : "Lecture seule"}</p>
            <h2 id="dossier-review-title">Revue dossier</h2>
            <span>{dossierReviewMetaLine(request)}</span>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </header>
        <textarea className="dossier-review-editor" readOnly={!canManage} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ajouter les notes de revue, décisions, points ouverts, actions à suivre..." />
        <section className="dossier-review-assets">
          <div className="dossier-review-assets-header">
            <div>
              <strong>Assets cloud</strong>
              <span>{documentsLoading ? "Chargement..." : `${documents.length} fichier${documents.length > 1 ? "s" : ""}`}</span>
            </div>
            {canManage && (
              <label className="secondary-action dossier-review-upload">
                <Upload size={16} />
                Ajouter assets
                <input ref={documentInputRef} type="file" multiple onChange={handleUploadDocuments} disabled={saving || documentsSaving} />
              </label>
            )}
          </div>
          <div className="dossier-review-asset-list">
            {documents.length === 0 && !documentsLoading ? (
              <span className="muted-text">Aucun asset cloud.</span>
            ) : documents.map((document) => (
              <div className="dossier-review-asset-item" key={document.id}>
                <a className="file-link" href={ecrDocumentDownloadUrl(document.id)} target="_blank" rel="noreferrer" title={document.fileName}>
                  {document.fileName}
                </a>
                {document.fileSize ? <small>{formatFileSize(document.fileSize)}</small> : null}
                {canManage && (
                  <button className="icon-button asset-delete-action" type="button" onClick={() => handleDeleteDocument(document.id)} title="Supprimer l'asset" disabled={documentsSaving}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
        <div className="button-row dossier-review-actions">
          {(canManage || canExport) && (
            <>
              {canManage && (
                <button className="primary-action" disabled={saving} type="submit">
                  <Save size={16} />
                  Enregistrer
                </button>
              )}
              {canExport && (
                <>
                  <button className="secondary-action" type="button" onClick={exportTxt}>
                    <FileText size={16} />
                    Export TXT
                  </button>
                  <button className="secondary-action" type="button" onClick={exportExcel}>
                    <FileText size={16} />
                    Export Excel
                  </button>
                  <button className="secondary-action" type="button" onClick={exportPdf}>
                    <FileText size={16} />
                    Export PDF
                  </button>
                </>
              )}
            </>
          )}
          <button className="secondary-action" type="button" onClick={onClose}>{canManage ? "Annuler" : "Fermer"}</button>
        </div>
      </form>
    </div>
  );
}
