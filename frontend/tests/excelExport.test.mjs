import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { createExcelWorkbook } from "../src/utils/excelExport.js";
import ExcelJS from "exceljs";

// Bundle the app's existing extensionless imports for Node, without changing runtime code.
const bundled = await build({ entryPoints: [fileURLToPath(new URL("../src/utils/businessExports.js", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const exports = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const users = [{ id: 999001, username: "sbenali", fullName: "Sonia Ben Ali", role: "CHEF_DE_PROJET; Qualité production", chef1: "mali", enabled: true, password: "SECRET_PASSWORD", token: "SECRET_TOKEN" }, { id: 999002, username: "mali", fullName: "Mohamed Ali" }];
const request = { id: 999003, modificationNumber: "MOD-2026-014", modificationProject: "Projet Atlas", client: "Client Exemple", pilot: "sbenali", currentStage: "FEASIBILITY_VALIDATION", receptionDate: "2026-10-14", archived: false };
const actions = [{ id: 999004, title: "Contrôler la qualité", responsible: "sbenali", workDurationDays: 0, startDate: "2026-10-14", endDate: "2026-10-14", stage: "FEASIBILITY_VALIDATION", status: "DONE", checked: true }, { id: 999005, title: "Valider la production", dependsOnActionId: 999004, responsible: "mali", status: "TODO", stage: "FEASIBILITY_VALIDATION", comment: '=HYPERLINK("https://example.com")' }];
const sheets = [exports.usersSheet(users), exports.projectsSheet([{ name: "Projet Atlas", projectTeam: "sbenali::CHEF_DE_PROJET|Qualité production; mali::MANAGER" }], users), exports.referenceSheet("Clients", [{ id: 999006, name: "Client Exemple" }]), exports.referenceSheet("Produits", []), exports.referenceSheet("Rôles", [{ name: "Qualité production" }]), exports.requestsSheet([request], users), exports.actionsSheet(actions, request, users), exports.rulesSheet([{ actionTitle: "Contrôle standard", stage: "FEASIBILITY_VALIDATION", durationDays: 2, appliesToModification: true }]), exports.finishedProductsSheet([{ partNumber: "00042", salePrice: 0, productionIntegrationDate: "2026-10-14" }]), exports.messagesSheet([{ senderName: "Sonia Ben Ali", createdAt: "2026-10-14T10:30:00Z", content: "Validation effectuée" }], "Projet Atlas"), exports.dossierSheet([{ ...request, dossierReview: "Contrôles validés.", dossierReviewAssets: [{ id: 999007, fileName: "Rapport qualité.pdf" }] }], users)];

test("all business exports round-trip as genuine xlsx without technical IDs or credentials", async () => {
  const workbook = await createExcelWorkbook({ title: "Exemple de vérification", sheets });
  const buffer = await workbook.xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.equal(reopened.worksheets.length, sheets.length);
  const values = [];
  reopened.eachSheet((sheet) => {
    assert.equal(sheet.views[0].ySplit, 6);
    assert.ok(sheet.autoFilter);
    sheet.eachRow((row) => row.eachCell((cell) => { assert.equal(cell.formula, undefined); values.push(String(cell.value ?? "")); }));
  });
  const text = values.join("\n");
  assert.doesNotMatch(text, /99900[1-7]|SECRET_|\[object Object\]|::|CHEF_DE_PROJET/);
  assert.match(text, /Sonia Ben Ali/);
  assert.match(text, /Mohamed Ali/);
  assert.match(text, /Rapport qualité.pdf/);
  const actionSheet = reopened.worksheets[6];
  assert.equal(actionSheet.getCell("M7").value, 0);
  assert.equal(actionSheet.getCell("K7").value.toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(actionSheet.getCell("O8").value, "Contrôler la qualité");
  assert.equal(actionSheet.getCell("U8").value, '=HYPERLINK("https://example.com")');
  assert.equal(reopened.worksheets[8].getCell("C7").value, "00042");
  assert.equal(reopened.worksheets[8].getCell("J7").value, 0);
  assert.equal(reopened.worksheets[9].getCell("B7").value.toISOString(), "2026-10-14T11:30:00.000Z");
  if (process.env.EXCEL_PREVIEW_PATH) await workbook.xlsx.writeFile(process.env.EXCEL_PREVIEW_PATH);
});

test("pagination does not truncate exported rows and empty results retain headers", async () => {
  const rows = Array.from({ length: 75 }, (_, index) => ({ name: `Client ${index + 1}` }));
  const workbook = await createExcelWorkbook({ title: "Clients", sheets: [exports.referenceSheet("Clients", rows), exports.referenceSheet("Vide", [])] });
  assert.equal(workbook.worksheets[0].getCell("A81").value, "Client 75");
  assert.equal(workbook.worksheets[1].getCell("A6").value, "Nom du rôle");
});

test("unmapped objects are rejected instead of leaking JSON or executable cells", async () => {
  await assert.rejects(() => createExcelWorkbook({ title: "Test", sheets: [{ name: "Test", rows: [{}], columns: [{ label: "Nom", value: () => ({ id: 123, formula: "1+1" }) }] }] }), /non lisible/);
});

test("missing dependency and unknown person never fall back to a numeric ID", () => {
  assert.equal(exports.personName(999999, users), "Personne non renseignée");
  const sheet = exports.actionsSheet([{ dependsOnActionId: 999999 }], request, users);
  assert.equal(sheet.columns[14].value(sheet.rows[0]), "Action préalable non disponible dans ce périmètre");
});
