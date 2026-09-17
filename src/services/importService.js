import * as XLSX from "xlsx";

// The fields a shop's product list can actually map onto. name is the
// only one that's genuinely required — everything else has a sensible
// fallback, since a real existing spreadsheet is unlikely to have all
// of these tracked cleanly, and the import shouldn't demand more
// structure than the shop owner's own records actually have.
export const IMPORT_FIELDS = [
  { key: "name", required: true },
  { key: "category", required: false },
  { key: "brand", required: false },
  { key: "unit", required: false },
  { key: "buyingPrice", required: false },
  { key: "sellingPrice", required: false },
  { key: "stock", required: false },
];

// Real spreadsheets format numbers as text constantly — thousands
// separators, trailing ".00", stray currency symbols someone pasted in.
// Strips everything except digits, a decimal point, and a leading minus,
// rather than requiring the cell to already be a clean number.
function parseNumericCell(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export const importService = {
  // Reads the raw file into headers + row objects. Blank rows are
  // already dropped by the underlying library when parsing as objects —
  // verified directly before relying on it, rather than assuming.
  parseWorkbook(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headerRow =
      XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })[0] || [];
    const headers = headerRow.filter(
      (h) => h !== null && String(h).trim() !== "",
    );
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    return { headers, rows };
  },

  // Applies the person's chosen header→field mapping to every row,
  // converting price/stock columns through the resilient numeric parser.
  // A row with no usable name is dropped rather than imported as a
  // nameless product — there's nothing useful to do with that row.
  applyMapping(rows, mapping) {
    const mapped = [];
    const skipped = [];
    for (const row of rows) {
      const nameHeader = mapping.name;
      const name = nameHeader ? String(row[nameHeader] ?? "").trim() : "";
      if (!name) {
        skipped.push(row);
        continue;
      }
      mapped.push({
        name,
        category: mapping.category
          ? String(row[mapping.category] ?? "").trim()
          : "",
        brand: mapping.brand ? String(row[mapping.brand] ?? "").trim() : "",
        unit: mapping.unit
          ? String(row[mapping.unit] ?? "").trim() || "pc"
          : "pc",
        buyingPrice: mapping.buyingPrice
          ? (parseNumericCell(row[mapping.buyingPrice]) ?? 0)
          : 0,
        sellingPrice: mapping.sellingPrice
          ? (parseNumericCell(row[mapping.sellingPrice]) ?? 0)
          : 0,
        stock: mapping.stock ? (parseNumericCell(row[mapping.stock]) ?? 0) : 0,
      });
    }
    return { mapped, skippedCount: skipped.length };
  },
};


