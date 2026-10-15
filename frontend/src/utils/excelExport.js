// Explicit business columns only: never serialize application objects into a workbook.
export async function createExcelWorkbook({ title, sheets, scope = "Toutes les lignes correspondant aux filtres, sur toutes les pages." }) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion des plannings";
  workbook.created = new Date();
  const exportedAt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tunis" }).format(workbook.created);
  sheets.forEach(({ name, columns, rows, note }, index) => {
    if (!columns.length) throw new Error("Aucune colonne définie pour cet export.");
    const sheet = workbook.addWorksheet(`${index + 1} ${name}`.replace(/[\\/*?:[\]]/g, " ").slice(0, 31));
    const lastColumn = Math.min(4, Math.max(2, columns.length));
    sheet.columns = columns.map((column) => ({ width: column.width || 26 }));
    if (columns.length === 1) sheet.getColumn(2).width = 26;
    const headingWidth = sheet.columns.slice(0, lastColumn).reduce((sum, column) => sum + (column.width || 26), 0);
    [title, `${name} — ${rows.length} ligne(s) — Exporté le ${exportedAt} (heure de Tunis)`, scope,
      note || "Les cellules vides indiquent une information non renseignée. Les dates sont au format jour/mois/année."].forEach((value, rowIndex) => {
      sheet.mergeCells(rowIndex + 1, 1, rowIndex + 1, lastColumn);
      const cell = sheet.getCell(rowIndex + 1, 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: rowIndex === 0 ? 18 : 11, bold: rowIndex === 0, color: { argb: rowIndex === 0 ? "FFFFFFFF" : "FF334155" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (rowIndex === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
      sheet.getRow(rowIndex + 1).height = rowIndex === 0 ? 36 : Math.max(32, Math.ceil(value.length / headingWidth) * 16 + 12);
    });
    const header = sheet.getRow(6);
    header.values = columns.map((column) => column.label);
    header.height = 36;
    header.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    rows.forEach((record, rowIndex) => {
      const row = sheet.getRow(rowIndex + 7);
      let lineCount = 1;
      columns.forEach((column, columnIndex) => {
        const raw = column.value(record);
        if (raw != null && typeof raw === "object" && !(raw instanceof Date)) {
          throw new Error(`La colonne « ${column.label} » contient une donnée non lisible.`);
        }
        const cell = row.getCell(columnIndex + 1);
        const value = raw == null ? null : typeof raw === "boolean" ? (raw ? "Oui" : "Non") : raw;
        if (typeof value === "string" && value.length > 32767) throw new Error(`Texte trop long dans « ${column.label} » pour une cellule Excel.`);
        // Strings remain literal text, including values beginning with =, +, - or @.
        cell.value = value;
        cell.numFmt = column.format || (value instanceof Date ? "dd/mm/yyyy" : typeof value === "number" ? "0.##" : "@");
        cell.font = { name: "Calibri", size: 11, color: { argb: "FF172033" } };
        cell.alignment = { vertical: "top", horizontal: typeof value === "number" ? "right" : "left", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIndex % 2 ? "FFF0FDF4" : "FFFFFFFF" } };
        const displayed = value instanceof Date ? (column.format?.includes("hh") ? "14/10/2026 11:30" : "14/10/2026") : String(value ?? "");
        const lines = displayed.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / ((column.width || 26) - 2))), 0);
        lineCount = Math.max(lineCount, lines);
      });
      row.height = Math.min(409, Math.max(30, lineCount * 15 + 10));
    });
    sheet.views = [{ state: "frozen", ySplit: 6, showGridLines: false }];
    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, rows.length + 6), column: columns.length } };
    sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:6" };
    sheet.headerFooter.oddFooter = "Page &P sur &N";
  });
  return workbook;
}

export async function downloadExcel(options) {
  const workbook = await createExcelWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${options.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
