import { getEcrDocuments } from "../../api";
import { stageLabel } from "../../utils/stages";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeExcelHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function requestDisplayName(request) {
  return request?.modificationNumber || request?.client || request?.product || "Modification sans reference";
}

export function fileNameToken(value) {
  return String(value || "modification")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "modification";
}

function dossierDate(value) {
  return value ? String(value).slice(0, 10) : "-";
}

export function dossierReviewMetaLine(request) {
  return [
    "Demande ECR",
    request.modificationNumber,
    request.client,
    request.product
  ].filter(Boolean).join(" | ");
}

function dossierReviewAssetNames(request) {
  const assets = request?.dossierReviewAssets || request?.dossierDocuments || [];
  return Array.isArray(assets)
    ? assets.map((asset) => asset?.fileName || asset?.name).filter(Boolean)
    : [];
}

function dossierReviewAssetsText(request) {
  const names = dossierReviewAssetNames(request);
  return names.length > 0 ? names.join("\n") : "";
}

export function withDossierReviewAssets(request, documents = []) {
  return {
    ...request,
    dossierReviewAssets: documents
  };
}

export function dossierReviewExportText(request, value) {
  const assetsText = dossierReviewAssetsText(request);
  return [
    "Revue dossier",
    dossierReviewMetaLine(request),
    "",
    value || "Revue dossier vide.",
    ...(assetsText ? ["", "Assets cloud", assetsText] : [])
  ].join("\n");
}

export function dossierReviewExportExcel(request, value) {
  const generatedAt = new Date().toLocaleString("fr-FR");
  const reviewText = value || "Revue dossier vide.";
  const assetsText = dossierReviewAssetsText(request);
  const detailRows = [
    ["N° client externe", request.modificationNumber],
    ["Client", request.client],
    ["Projet", request.modificationProject],
    ["Produit", request.product],
    ["Produits finis", request.finishedProducts],
    ["Pilote", request.pilot],
    ["Réception", dossierDate(request.receptionDate)],
    ["Phase", stageLabel(request.currentStage, Boolean(request.newVersion))],
    ["Extraction générée le", generatedAt]
  ].map(([label, fieldValue]) => `<tr>
    <td class="label">${escapeExcelHtml(label)}</td>
    <td class="value" colspan="3">${escapeExcelHtml(fieldValue || "-")}</td>
  </tr>`).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Revue dossier - ${escapeHtml(requestDisplayName(request))}</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#172008;margin:0;background:#fff}
    table{border-collapse:collapse;table-layout:fixed;width:980px}
    col.c1{width:170px} col.c2{width:270px} col.c3{width:170px} col.c4{width:370px}
    td,th{border:1px solid #c8d8ad;padding:7px 9px;vertical-align:top;font-size:11px;mso-number-format:"\\@";white-space:normal;line-height:1.3}
    .brand{background:#ffffff;color:#5f7f13;font-size:18px;font-weight:800;text-align:center;vertical-align:middle;border:2px solid #5f7f13}
    .brand small{display:block;color:#586148;font-size:10px;font-weight:700;letter-spacing:.5px}
    .title{background:#5f7f13;color:#ffffff;font-size:18px;font-weight:800;text-align:left;vertical-align:middle}
    .subtitle{background:#edf3df;color:#172008;font-weight:700}
    .meta{background:#f7f9f1;color:#586148}
    .section{background:#5f7f13;color:#ffffff;font-weight:800;text-align:left}
    .label{background:#edf3df;color:#172008;font-weight:800}
    .value{background:#ffffff;color:#172008}
    .review{font-size:12px;line-height:1.4;white-space:normal;vertical-align:top}
  </style></head><body><table>
    <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"></colgroup>
    <tr><td class="brand" rowspan="3">SAGE<small>Automotive Interiors</small></td><td class="title" colspan="3">Revue dossier - modification</td></tr>
    <tr><td class="subtitle" colspan="3">${escapeExcelHtml(requestDisplayName(request))}</td></tr>
    <tr><td class="meta" colspan="3">Extraction generee le ${escapeHtml(generatedAt)}</td></tr>
    ${detailRows}
    <tr><td class="section" colspan="4">Revue dossier</td></tr>
    <tr><td class="review" colspan="4">${escapeExcelHtml(reviewText)}</td></tr>
    ${assetsText ? `<tr><td class="section" colspan="4">Assets cloud</td></tr><tr><td class="review" colspan="4">${escapeExcelHtml(assetsText)}</td></tr>` : ""}
  </table></body></html>`;
}

export function dossierReviewPdfHtml(request, value) {
  const title = `Revue dossier - ${requestDisplayName(request)}`;
  const generatedAt = new Date().toLocaleString("fr-FR");
  const reviewText = value || "Revue dossier vide.";
  const assetsText = dossierReviewAssetsText(request);
  const detailRows = [
    ["N° client externe", request.modificationNumber],
    ["Client", request.client],
    ["Projet", request.modificationProject],
    ["Produit", request.product],
    ["Produits finis", request.finishedProducts],
    ["Pilote", request.pilot],
    ["Réception", dossierDate(request.receptionDate)],
    ["Phase", stageLabel(request.currentStage, Boolean(request.newVersion))]
  ].map(([label, fieldValue]) => `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(fieldValue || "-")}</strong></div>`).join("");
  const reviewPages = splitDossierReviewPages(reviewText);
  const pagesHtml = reviewPages.map((pageText, index) => `<main class="pdf-export-page dossier-review-export-page">
    <header class="brand-header">
      <div class="brand-block">
        <img class="sage-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" />
        <div>
          <h1>REVUE <span>DOSSIER</span></h1>
          <div class="subtitle">${escapeHtml(requestDisplayName(request))}<br>Client: ${escapeHtml(request.client || "-")} | Projet: ${escapeHtml(request.modificationProject || "-")}</div>
        </div>
      </div>
      <div class="stamp"><strong>SAGE-INS-ENG-32</strong>Extraction PDF<br>${escapeHtml(generatedAt)}<br>Page ${index + 1} / ${reviewPages.length}</div>
    </header>
    <section class="meta-grid">${detailRows}</section>
    <div class="section-title"><h2>Notes de revue</h2></div>
    <section class="review-box"><pre>${escapeHtml(pageText)}</pre></section>
    ${assetsText && index === reviewPages.length - 1 ? `<div class="section-title asset-section-title"><h2>Assets cloud</h2></div><section class="asset-name-box"><pre>${escapeHtml(assetsText)}</pre></section>` : ""}
    <footer class="footer"><span>SAGE Automotive Interiors</span><span>${escapeHtml(dossierReviewMetaLine(request))}</span></footer>
  </main>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 portrait;margin:12mm}
    *{box-sizing:border-box}
    html,body,.pdf-export-page,.brand-header,.meta-card,.review-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;color:#172008;margin:0;background:#f7f9f1}
    .pdf-export-page{width:900px;height:1240px;background:#f7f9f1;padding:24px;margin:0 0 20px;display:flex;flex-direction:column;overflow:hidden}
    .brand-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;background:#fff;border-bottom:4px solid #5f7f13;padding:0 0 14px;margin-bottom:18px}
    .brand-block{display:flex;align-items:flex-start;gap:14px}
    .sage-logo{display:block;height:58px;width:136px;object-fit:contain;border:1px solid #bfd0a3;border-radius:4px;padding:6px;background:#fff}
    h1{font-family:Georgia,serif;font-size:30px;line-height:1.05;margin:0;text-transform:uppercase;color:#172008}
    h1 span{color:#5f7f13}
    .subtitle{color:#586148;font-size:12px;line-height:1.45;margin-top:7px}
    .stamp{border:1px solid #bfd0a3;background:#edf3df;color:#172008;padding:8px 10px;text-align:right;font-size:11px;min-width:180px}
    .stamp strong{display:block;font-size:13px;margin-bottom:3px}
    .meta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:18px}
    .meta-card{background:#fff;border:1px solid #d9e3c8;border-left:4px solid #5f7f13;padding:9px 10px;min-height:54px}
    .meta-card span{display:block;color:#586148;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:4px}
    .meta-card strong{display:block;font-size:14px;line-height:1.25;overflow-wrap:anywhere}
    .section-title{display:flex;align-items:center;gap:10px;margin:12px 0 8px;color:#172008}
    .section-title:before{content:"";display:block;width:32px;height:7px;background:#5f7f13}
    .section-title h2{font-size:18px;margin:0;text-transform:uppercase}
    .review-box{background:#fff;border:1px solid #bfd0a3;flex:1;min-height:0;padding:18px 20px;box-shadow:inset 0 0 0 4px #f1f6e8;overflow:hidden}
    .review-box pre{font-family:Arial,sans-serif;font-size:13px;line-height:1.55;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#172008}
    .asset-section-title{margin-top:10px}
    .asset-name-box{background:#fff;border:1px solid #bfd0a3;padding:10px 12px;max-height:120px;overflow:hidden}
    .asset-name-box pre{font-family:Arial,sans-serif;font-size:12px;line-height:1.4;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#172008}
    .footer{display:flex;justify-content:space-between;gap:12px;margin-top:16px;border-top:1px solid #bfd0a3;padding-top:10px;color:#586148;font-size:11px}
  </style></head><body>${pagesHtml}</body></html>`;
}

function splitDossierReviewPages(value) {
  const normalized = String(value || "Revue dossier vide.").replace(/\r\n/g, "\n");
  const sourceLines = normalized.split("\n");
  const maxVisualLines = 31;
  const maxCharsPerLine = 94;
  const pages = [];
  let currentLines = [];
  let currentVisualLines = 0;
  sourceLines.forEach((line) => {
    const visualLines = Math.max(1, Math.ceil(line.length / maxCharsPerLine));
    if (currentLines.length > 0 && currentVisualLines + visualLines > maxVisualLines) {
      pages.push(currentLines.join("\n"));
      currentLines = [];
      currentVisualLines = 0;
    }
    currentLines.push(line);
    currentVisualLines += visualLines;
  });
  if (currentLines.length > 0) {
    pages.push(currentLines.join("\n"));
  }
  return pages.length > 0 ? pages : ["Revue dossier vide."];
}

export function projectDossierReviewsExportText(projectName, projectRequests) {
  const sortedRequests = sortedProjectDossierRequests(projectRequests);
  return [
    `Extraction revue dossier par projet`,
    `Projet: ${projectName || "Projet non renseigne"}`,
    `Modifications: ${sortedRequests.length}`,
    `Date extraction: ${new Date().toLocaleString("fr-FR")}`,
    "",
    ...sortedRequests.flatMap((request, index) => [
      "============================================================",
      `${index + 1}. ${requestDisplayName(request)}`,
      dossierReviewMetaLine(request),
      `Pilote: ${request.pilot || "-"}`,
      `Phase: ${stageLabel(request.currentStage, Boolean(request.newVersion))}`,
      "",
      request.dossierReview || "Revue dossier vide.",
      ...(dossierReviewAssetsText(request) ? ["", "Assets cloud", dossierReviewAssetsText(request)] : []),
      ""
    ])
  ].join("\n");
}

function sortedProjectDossierRequests(projectRequests) {
  return [...projectRequests].sort((first, second) =>
    requestDisplayName(first).localeCompare(requestDisplayName(second), "fr", { sensitivity: "base" })
  );
}

export async function loadDossierAssetsForRequests(projectRequests) {
  const entries = await Promise.all(projectRequests.map((request) =>
    getEcrDocuments(request.id)
      .then((documents) => [request.id, documents])
      .catch(() => [request.id, []])
  ));
  const documentsByRequestId = new Map(entries);
  return projectRequests.map((request) => withDossierReviewAssets(request, documentsByRequestId.get(request.id) || []));
}

export function projectDossierReviewsExportHtml(projectName, projectRequests) {
  const sortedRequests = sortedProjectDossierRequests(projectRequests);
  const generatedAt = new Date().toLocaleString("fr-FR");
  const pagesHtml = sortedRequests.flatMap((request, requestIndex) => {
    const reviewPages = splitDossierReviewPages(request.dossierReview || "Revue dossier vide.");
    const assetsText = dossierReviewAssetsText(request);
    const detailRows = [
      ["N° client externe", request.modificationNumber],
      ["Client", request.client],
      ["Projet", request.modificationProject || projectName],
      ["Produit", request.product],
      ["Produits finis", request.finishedProducts],
      ["Pilote", request.pilot],
      ["Réception", dossierDate(request.receptionDate)],
      ["Phase", stageLabel(request.currentStage, Boolean(request.newVersion))]
    ].map(([label, value]) => `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`).join("");
    return reviewPages.map((pageText, pageIndex) => `<main class="pdf-export-page dossier-review-export-page">
      <header class="brand-header">
        <div class="brand-block"><img class="sage-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" /><div><h1>REVUES <span>DOSSIER</span></h1><div class="subtitle">Projet: ${escapeHtml(projectName || "Projet non renseigne")}<br>${requestIndex + 1}. ${escapeHtml(requestDisplayName(request))}</div></div></div>
        <div class="stamp"><strong>SAGE-INS-ENG-32</strong>Extraction PDF<br>${escapeHtml(generatedAt)}<br>Modification ${requestIndex + 1} / ${sortedRequests.length}<br>Page ${pageIndex + 1} / ${reviewPages.length}</div>
      </header>
      <section class="meta-grid">${detailRows}</section>
      <div class="section-title"><h2>Notes de revue</h2></div>
      <section class="review-box"><pre>${escapeHtml(pageText)}</pre></section>
      ${assetsText && pageIndex === reviewPages.length - 1 ? `<div class="section-title asset-section-title"><h2>Assets cloud</h2></div><section class="asset-name-box"><pre>${escapeHtml(assetsText)}</pre></section>` : ""}
      <footer class="footer"><span>SAGE Automotive Interiors</span><span>${escapeHtml(dossierReviewMetaLine(request))}</span></footer>
    </main>`);
  }).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Extraction revue dossier - ${escapeHtml(projectName)}</title><style>
    @page{size:A4 portrait;margin:12mm}
    *{box-sizing:border-box}
    html,body,.pdf-export-page,.brand-header,.meta-card,.review-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;color:#172008;margin:0;background:#f7f9f1}
    .pdf-export-page{width:900px;height:1240px;background:#f7f9f1;padding:24px;margin:0 0 20px;display:flex;flex-direction:column;overflow:hidden}
    .brand-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;background:#fff;border-bottom:4px solid #5f7f13;padding:0 0 14px;margin-bottom:18px}
    .brand-block{display:flex;align-items:flex-start;gap:14px}
    .sage-logo{display:block;height:58px;width:136px;object-fit:contain;border:1px solid #bfd0a3;border-radius:4px;padding:6px;background:#fff}
    h1{font-family:Georgia,serif;font-size:30px;line-height:1.05;margin:0;text-transform:uppercase;color:#172008}
    h1 span{color:#5f7f13}
    .subtitle{color:#586148;font-size:12px;line-height:1.45;margin-top:7px}
    .stamp{border:1px solid #bfd0a3;background:#edf3df;color:#172008;padding:8px 10px;text-align:right;font-size:11px;min-width:190px}
    .stamp strong{display:block;font-size:13px;margin-bottom:3px}
    .meta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:18px}
    .meta-card{background:#fff;border:1px solid #d9e3c8;border-left:4px solid #5f7f13;padding:9px 10px;min-height:54px}
    .meta-card span{display:block;color:#586148;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:4px}
    .meta-card strong{display:block;font-size:14px;line-height:1.25;overflow-wrap:anywhere}
    .section-title{display:flex;align-items:center;gap:10px;margin:12px 0 8px;color:#172008}
    .section-title:before{content:"";display:block;width:32px;height:7px;background:#5f7f13}
    .section-title h2{font-size:18px;margin:0;text-transform:uppercase}
    .review-box{background:#fff;border:1px solid #bfd0a3;flex:1;min-height:0;padding:18px 20px;box-shadow:inset 0 0 0 4px #f1f6e8;overflow:hidden}
    .review-box pre{font-family:Arial,sans-serif;font-size:13px;line-height:1.55;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#172008}
    .asset-section-title{margin-top:10px}
    .asset-name-box{background:#fff;border:1px solid #bfd0a3;padding:10px 12px;max-height:120px;overflow:hidden}
    .asset-name-box pre{font-family:Arial,sans-serif;font-size:12px;line-height:1.4;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#172008}
    .footer{display:flex;justify-content:space-between;gap:12px;margin-top:16px;border-top:1px solid #bfd0a3;padding-top:10px;color:#586148;font-size:11px}
  </style></head><body>${pagesHtml}</body></html>`;
}

export function projectDossierReviewsExportExcel(projectName, projectRequests) {
  const sortedRequests = sortedProjectDossierRequests(projectRequests);
  const generatedAt = new Date().toLocaleString("fr-FR");
  const rows = sortedRequests.map((request, index) => `<tr>
      <td class="center">${index + 1}</td>
      <td>${escapeExcelHtml(request.modificationProject || projectName || "")}</td>
      <td>${escapeExcelHtml(requestDisplayName(request))}</td>
      <td>${escapeExcelHtml(request.modificationNumber || "")}</td>
      <td>${escapeExcelHtml(request.client || "")}</td>
      <td>${escapeExcelHtml(request.product || "")}</td>
      <td>${escapeExcelHtml(request.finishedProducts || "")}</td>
      <td>${escapeExcelHtml(request.pilot || "")}</td>
      <td>${escapeHtml(request.receptionDate || "")}</td>
      <td>${escapeExcelHtml(stageLabel(request.currentStage, Boolean(request.newVersion)))}</td>
      <td class="review">${escapeExcelHtml(request.dossierReview || "Revue dossier vide.")}</td>
      <td class="assets">${escapeExcelHtml(dossierReviewAssetsText(request))}</td>
    </tr>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Export revue dossier - ${escapeHtml(projectName || "Projet")}</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#172008;margin:0;background:#fff}
    table{border-collapse:collapse;table-layout:fixed;width:1960px}
    col.c0{width:46px} col.c1{width:160px} col.c2{width:170px} col.c3{width:145px} col.c4{width:145px}
    col.c5{width:160px} col.c6{width:180px} col.c7{width:140px} col.c8{width:110px} col.c9{width:165px} col.c10{width:540px} col.c11{width:200px}
    td,th{border:1px solid #c8d8ad;padding:6px 8px;vertical-align:top;font-size:11px;mso-number-format:"\\@";white-space:normal;line-height:1.25}
    .brand{background:#ffffff;color:#5f7f13;font-size:18px;font-weight:800;text-align:center;vertical-align:middle;border:2px solid #5f7f13}
    .brand small{display:block;color:#586148;font-size:10px;font-weight:700;letter-spacing:.5px}
    .title{background:#5f7f13;color:#ffffff;font-size:18px;font-weight:800;text-align:left;vertical-align:middle}
    .subtitle{background:#edf3df;color:#172008;font-weight:700}
    .meta{background:#f7f9f1;color:#586148}
    th{background:#5f7f13;color:#ffffff;font-weight:800;text-align:center}
    .center{text-align:center;vertical-align:middle}
    .review{width:540px;white-space:normal}
    .assets{width:200px;white-space:normal}
    tr:nth-child(even) td{background:#fbfdf8}
  </style></head><body><table>
    <colgroup><col class="c0"><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"><col class="c8"><col class="c9"><col class="c10"><col class="c11"></colgroup>
    <tr><td class="brand" colspan="2" rowspan="3">SAGE<small>Automotive Interiors</small></td><td class="title" colspan="10">Extraction revue dossier par projet</td></tr>
    <tr><td class="subtitle" colspan="10">Projet: ${escapeHtml(projectName || "Projet non renseigne")} | Modifications: ${sortedRequests.length}</td></tr>
    <tr><td class="meta" colspan="10">Extraction generee le ${escapeHtml(generatedAt)} | SAGE Automotive Interiors</td></tr>
    <tr><th>N°</th><th>Projet</th><th>Modification</th><th>N° client externe</th><th>Client</th><th>Produit</th><th>Produits finis</th><th>Pilote</th><th>Reception</th><th>Phase</th><th>Revue dossier</th><th>Assets cloud</th></tr>
    ${rows}
  </table></body></html>`;
}
