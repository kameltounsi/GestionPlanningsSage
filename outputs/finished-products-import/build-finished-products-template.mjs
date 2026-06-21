import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/kamel/OneDrive/Documents/GestionPlanning/outputs/finished-products-import";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Import produits finis");
const helpSheet = workbook.worksheets.add("Aide");

sheet.showGridLines = false;
helpSheet.showGridLines = false;

const headers = [
  "client",
  "project",
  "partNumber",
  "designation",
  "customerPn",
  "product",
  "coiffeIndex",
  "drawingIndex",
  "reducedCode",
  "salePrice",
  "productionIntegrationDate",
  "comments",
];

const rows = [
  [
    "REMPLACER_CLIENT_EXISTANT",
    "REMPLACER_PROJET_EXISTANT",
    "PF-TEST-001",
    "Designation exemple",
    "CPN-TEST-001",
    "REMPLACER_PRODUIT_EXISTANT",
    "A",
    "01",
    "RC-TEST-001",
    12.5,
    new Date("2026-06-21T00:00:00"),
    "Ligne exemple: remplacez client/project/product par des valeurs deja creees dans la base.",
  ],
  [
    "remplacer_client_existant",
    "remplacer_projet_existant",
    "PF-TEST-002",
    "Designation exemple 2",
    "CPN-TEST-002",
    "remplacer_produit_existant",
    "B",
    "02",
    "RC-TEST-002",
    9.75,
    new Date("2026-06-22T00:00:00"),
    "Cette ligne montre que la casse est ignoree pour client/projet/produit.",
  ],
  [
    "REMPLACER_CLIENT_EXISTANT",
    "REMPLACER_PROJET_EXISTANT",
    "PF-TEST-001",
    "Doublon volontaire",
    "CPN-TEST-003",
    "REMPLACER_PRODUIT_EXISTANT",
    "C",
    "03",
    "RC-TEST-003",
    10,
    new Date("2026-06-23T00:00:00"),
    "Doublon volontaire de partNumber: doit etre ignore par l'import.",
  ],
];

sheet.getRange("A1:L4").values = [headers, ...rows];
sheet.freezePanes.freezeRows(1);
sheet.tables.add("A1:L4", true, "FinishedProductsImportTable");

sheet.getRange("A1:L1").format = {
  fill: "#6b7f13",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
};
sheet.getRange("A1:L4").format.borders = { preset: "outside", style: "thin", color: "#B8C28A" };
sheet.getRange("A2:L4").format = {
  fill: "#FBFCF4",
  font: { color: "#18220C" },
  wrapText: true,
};
sheet.getRange("J2:J4").format.numberFormat = "0.000";
sheet.getRange("K2:K4").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("A:A").format.columnWidth = 28;
sheet.getRange("B:B").format.columnWidth = 28;
sheet.getRange("C:C").format.columnWidth = 18;
sheet.getRange("D:D").format.columnWidth = 24;
sheet.getRange("E:E").format.columnWidth = 18;
sheet.getRange("F:F").format.columnWidth = 28;
sheet.getRange("G:I").format.columnWidth = 16;
sheet.getRange("J:K").format.columnWidth = 18;
sheet.getRange("L:L").format.columnWidth = 58;
sheet.getRange("A1:L4").format.rowHeight = 36;

helpSheet.getRange("A1:E1").merge();
helpSheet.getRange("A1").values = [["Import en masse - Produits finis"]];
helpSheet.getRange("A1:E1").format = {
  fill: "#6b7f13",
  font: { bold: true, color: "#FFFFFF", size: 14 },
};
helpSheet.getRange("A3:B10").values = [
  ["Regle", "Detail"],
  ["Feuille importee", "La premiere feuille du fichier est lue par l'application."],
  ["References obligatoires", "client, project/projet et product/produit doivent exister dans la base."],
  ["Majuscules/minuscules", "La comparaison ignore la casse, mais l'application conserve l'ecriture officielle en base."],
  ["Doublons", "partNumber et reducedCode deja existants, ou repetes dans le fichier, sont ignores."],
  ["Colonnes obligatoires", "client, project, partNumber, product, reducedCode."],
  ["Date", "Utilisez le format yyyy-mm-dd ou une vraie date Excel."],
  ["Prix", "Utilisez un nombre, par exemple 12.500."],
];
helpSheet.tables.add("A3:B10", true, "ImportRulesTable");
helpSheet.getRange("A3:B3").format = {
  fill: "#dfe8bc",
  font: { bold: true, color: "#283900" },
};
helpSheet.getRange("A4:B10").format = {
  fill: "#FFFFFF",
  wrapText: true,
};
helpSheet.getRange("A:B").format.columnWidth = 36;
helpSheet.getRange("B:B").format.columnWidth = 78;
helpSheet.getRange("A3:B10").format.borders = { preset: "outside", style: "thin", color: "#B8C28A" };

const inspect = await workbook.inspect({
  kind: "table",
  range: "Import produits finis!A1:L4",
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 12,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Import produits finis",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/modele-import-produits-finis-preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/modele-import-produits-finis.xlsx`);
