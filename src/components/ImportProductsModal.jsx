import React, { useState } from "react";
import { importService, IMPORT_FIELDS } from "../services/importService";
import { batchService } from "../services/batchService";
import { dataService } from "../services/DataService";
import { useLanguage } from "../context/LanguageContext.jsx";
import StepIndicator from "./StepIndicator.jsx";

// Four steps — upload, map columns, preview, then actually import —
// because a real existing spreadsheet's column names never match this
// app's field names exactly, and importing real business data wrong
// (mismatched columns, prices in the wrong field) is expensive to
// discover after the fact. The preview step exists specifically so a
// bad mapping gets caught before anything touches the database.
const STEPS = ["upload", "map", "preview", "done"];

const ImportProductsModal = ({
  visible,
  existingProducts,
  onImported,
  onClose,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  if (!visible) return null;

  const resetAndClose = () => {
    setStep(0);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError("");
    onClose();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers: h, rows: r } = importService.parseWorkbook(
          reader.result,
        );
        if (h.length === 0 || r.length === 0) {
          setError(t("importEmptyFileError"));
          return;
        }
        setFileName(file.name);
        setHeaders(h);
        setRows(r);
        // A sensible starting guess: match a header to a field if its
        // name contains the field's key — the person can always
        // override any of these before continuing.
        const guessed = {};
        for (const field of IMPORT_FIELDS) {
          const match = h.find((header) =>
            String(header).toLowerCase().includes(field.key.toLowerCase()),
          );
          if (match) guessed[field.key] = match;
        }
        setMapping(guessed);
        setStep(1);
      } catch (err) {
        console.error("Excel parse error:", err);
        setError(t("importParseError"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const goToPreview = () => {
    if (!mapping.name) {
      setError(t("importNameRequiredError"));
      return;
    }
    setError("");
    setStep(2);
  };

  const previewData = () => importService.applyMapping(rows, mapping);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    setError("");
    try {
      const { mapped, skippedCount: skipped } = importService.applyMapping(
        rows,
        mapping,
      );
      const existingNames = new Set(
        existingProducts.map((p) => p.name.trim().toLowerCase()),
      );
      const now = new Date().toISOString();

      // Products whose name already exists are skipped entirely, not
      // merged or overwritten — an import shouldn't silently change
      // prices or stock on something already being tracked. Duplicate
      // handling belongs in a dedicated edit flow, not a bulk import.
      const newProducts = mapped.filter(
        (p) => !existingNames.has(p.name.trim().toLowerCase()),
      );
      const duplicateCount = mapped.length - newProducts.length;

      const built = newProducts.map((p) => {
        const base = {
          id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: p.name,
          category: p.category,
          brand: p.brand,
          unit: p.unit,
          sellingPrice: p.sellingPrice,
          buyingPrice: 0,
          stock: 0,
          imageUri: null,
          expiryDate: null,
          createdAt: now,
        };
        return p.stock > 0
          ? batchService.addBatch(
              { ...base, stockBatches: [] },
              p.stock,
              p.buyingPrice,
              now,
            )
          : { ...base, buyingPrice: p.buyingPrice };
      });

      await dataService.upsertProducts(built);

      setImportedCount(built.length);
      setSkippedCount(skipped + duplicateCount);
      setStep(3);
      onImported();
    } catch (err) {
      console.error("Import error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setImporting(false);
    }
  };

  const stepLabel = (i) => {
    if (i === 0) return t("importStepUpload");
    if (i === 1) return t("importStepMap");
    if (i === 2) return t("importStepPreview");
    return t("importStepDone");
  };

  return (
    <div style={styles.overlay} onClick={resetAndClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("importProductsTitle")}</h2>

        {step < 3 && (
          <StepIndicator
            steps={STEPS.slice(0, 3)}
            currentStep={step}
            stepLabel={stepLabel}
          />
        )}

        {error && <div style={styles.error}>{error}</div>}

        {step === 0 && (
          <div style={styles.uploadArea}>
            <p style={styles.uploadHint}>{t("importUploadHint")}</p>
            <label style={styles.uploadBtn}>
              {t("chooseFileButton")}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div style={styles.mapArea}>
            <p style={styles.mapHint}>
              {t("importMapHint", { file: fileName })}
            </p>
            {IMPORT_FIELDS.map((field) => (
              <div key={field.key} style={styles.mapRow}>
                <span style={styles.mapFieldLabel}>
                  {t(`importField_${field.key}`)}
                  {field.required && (
                    <span style={styles.requiredMark}> *</span>
                  )}
                </span>
                <select
                  style={styles.mapSelect}
                  value={mapping[field.key] || ""}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      [field.key]: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">{t("importNotMappedOption")}</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {step === 2 &&
          (() => {
            const { mapped, skippedCount: previewSkipped } = previewData();
            const existingNames = new Set(
              existingProducts.map((p) => p.name.trim().toLowerCase()),
            );
            const willImport = mapped.filter(
              (p) => !existingNames.has(p.name.trim().toLowerCase()),
            );
            const willSkipDuplicate = mapped.length - willImport.length;
            return (
              <div style={styles.previewArea}>
                <p style={styles.previewSummary}>
                  {t("importPreviewSummary", { count: willImport.length })}
                </p>
                {(previewSkipped > 0 || willSkipDuplicate > 0) && (
                  <p style={styles.previewWarning}>
                    {previewSkipped > 0 &&
                      t("importSkippedNoNameNote", { count: previewSkipped })}
                    {previewSkipped > 0 && willSkipDuplicate > 0 && " "}
                    {willSkipDuplicate > 0 &&
                      t("importSkippedDuplicateNote", {
                        count: willSkipDuplicate,
                      })}
                  </p>
                )}
                <div style={styles.previewTable}>
                  {willImport.slice(0, 8).map((p, i) => (
                    <div key={i} style={styles.previewRow}>
                      <span style={styles.previewName}>{p.name}</span>
                      <span style={styles.previewMeta}>
                        {p.sellingPrice
                          ? `TZS ${Math.round(p.sellingPrice).toLocaleString("en-US")}`
                          : "—"}{" "}
                        · {t("tableQuantity")}: {p.stock}
                      </span>
                    </div>
                  ))}
                  {willImport.length > 8 && (
                    <div style={styles.previewMore}>
                      {t("importAndMoreNote", { count: willImport.length - 8 })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        {step === 3 && (
          <div style={styles.doneArea}>
            <div style={styles.doneCheck}>✓</div>
            <p style={styles.doneText}>
              {t("importCompleteSummary", { count: importedCount })}
            </p>
            {skippedCount > 0 && (
              <p style={styles.doneSkipped}>
                {t("importCompleteSkipped", { count: skippedCount })}
              </p>
            )}
          </div>
        )}

        <div style={styles.actions}>
          {step === 0 && (
            <button style={styles.cancelBtn} onClick={resetAndClose}>
              {t("cancelButton")}
            </button>
          )}
          {step === 1 && (
            <>
              <button style={styles.cancelBtn} onClick={() => setStep(0)}>
                {t("backButton")}
              </button>
              <button style={styles.nextBtn} onClick={goToPreview}>
                {t("continueButton")}
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button style={styles.cancelBtn} onClick={() => setStep(1)}>
                {t("backButton")}
              </button>
              <button
                style={styles.nextBtn}
                disabled={importing}
                onClick={handleImport}
              >
                {importing ? t("completing") : t("importConfirmButton")}
              </button>
            </>
          )}
          {step === 3 && (
            <button style={styles.nextBtn} onClick={resetAndClose}>
              {t("closeButton")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: 480,
    maxHeight: "85vh",
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    overflow: "auto",
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 16 },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  uploadArea: { textAlign: "center", padding: "32px 0" },
  uploadHint: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  uploadBtn: {
    display: "inline-block",
    padding: "13px 24px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  mapArea: { marginBottom: 4 },
  mapHint: { fontSize: 12, color: "var(--text-muted)", marginBottom: 16 },
  mapRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  mapFieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-primary)",
    flexShrink: 0,
    width: 120,
  },
  requiredMark: { color: "var(--danger)" },
  mapSelect: {
    flex: 1,
    padding: "9px 10px",
    border: "1.5px solid var(--border)",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  previewArea: { marginBottom: 4 },
  previewSummary: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  previewWarning: { fontSize: 12, color: "var(--warning)", marginBottom: 14 },
  previewTable: { background: "var(--bg)", borderRadius: 12, padding: 12 },
  previewRow: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "8px 0",
    borderBottom: "1px solid var(--border-muted)",
  },
  previewName: { fontSize: 13, fontWeight: 700, color: "var(--text-primary)" },
  previewMeta: { fontSize: 11, color: "var(--text-muted)" },
  previewMore: {
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "center",
    paddingTop: 8,
    fontWeight: 600,
  },
  doneArea: { textAlign: "center", padding: "24px 0" },
  doneCheck: {
    width: 56,
    height: 56,
    borderRadius: 999,
    background: "var(--success-light)",
    color: "var(--success)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 800,
    margin: "0 auto 16px",
  },
  doneText: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  doneSkipped: { fontSize: 12, color: "var(--text-muted)" },
  actions: { display: "flex", gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  nextBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default ImportProductsModal;


