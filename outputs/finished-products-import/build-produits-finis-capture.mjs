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
    "J4U",
    "CA",
    "LSDS",
    "LSL",
    "SLSL",
    "Auxiliaire",
    "",
    "",
    "5S2",
    45,
    new Date(2027, 7, 14),
    "",
  ],
  [
    "J4U",
    "CA",
    "PF-TEST-005",
    "Doublon volontaire",
    "CPN-TEST-003",
    "SKODA",
    "",
    "",
    "RC-TEST-003",
    10,
    new Date(2026, 5, 23),
    "",
  ],
  [
    "J4U",
    "CE",
    "PF-TEST-002",
    "Designation exemple 2",
    "CPN-TEST-002",
    "SKODA",
    "",
    "",
    "RC-TEST-002",
    9.75,
    new Date(2026, 5, 22),
    "",
  ],
];

sheet.getRange("A1:L4").values = [headers, ...rows];
sheet.freezePanes.freezeRows(1);
sheet.tables.add("A1:L4", true, "FinishedProductsImportTable");

sheet.getRange("A1:L1").format = {
  fill: "#6B7F13",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
};
sheet.getRange("A2:L4").format = {
  fill: "#FBFCF4",
  font: { color: "#18220C" },
  wrapText: true,
};
sheet.getRange("A1:L4").format.borders = { preset: "outside", style: "thin", color: "#B8C28A" };
sheet.getRange("J2:J4").format.numberFormat = "0.00";
sheet.getRange("K2:K4").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("A:B").format.columnWidth = 14;
sheet.getRange("C:C").format.columnWidth = 18;
sheet.getRange("D:F").format.columnWidth = 24;
sheet.getRange("G:I").format.columnWidth = 16;
sheet.getRange("J:K").format.columnWidth = 18;
sheet.getRange("L:L").format.columnWidth = 40;
sheet.getRange("A1:L4").format.rowHeight = 28;

helpSheet.getRange("A1:E1").merge();
helpSheet.getRange("A1").values = [["Modele import - Produits finis"]];
helpSheet.getRange("A1:E1").format = {
  fill: "#6B7F13",
  font: { bold: true, color: "#FFFFFF" },
};
helpSheet.getRange("A3:B10").values = [
  ["Champ", "Regle"],
  ["client", "Obligatoire. Doit exister dans les referentiels."],
  ["project", "Obligatoire. Doit exister dans les projets."],
  ["partNumber", "Obligatoire et unique."],
  ["product", "Obligatoire. Doit exister dans les produits."],
  ["reducedCode", "Obligatoire et unique."],
  ["salePrice", "Nombre Excel, sans devise."],
  ["productionIntegrationDate", "Date Excel ou format yyyy-mm-dd."],
];
helpSheet.tables.add("A3:B10", true, "ImportRulesTable");
helpSheet.getRange("A3:B3").format = {
  fill: "#DFE8BC",
  font: { bold: true, color: "#283900" },
};
helpSheet.getRange("A4:B10").format = {
  fill: "#FFFFFF",
  wrapText: true,
};
helpSheet.getRange("A:B").format.columnWidth = 34;
helpSheet.getRange("B:B").format.columnWidth = 62;
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
await fs.writeFile(`${outputDir}/produits-finis-import-capture-preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/produits-finis-import-capture.xlsx`);
