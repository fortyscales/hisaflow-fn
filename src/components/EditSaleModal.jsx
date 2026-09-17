import React, { useState, useEffect } from "react";
import { salesService } from "../services/salesService";
import { useLanguage } from "../context/LanguageContext.jsx";
import FormattedNumberInput from "./FormattedNumberInput.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const EditSaleModal = ({ visible, sale, onSaved, onClose }) => {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && sale) {
      setQuantity(String(sale.quantity || ""));
      setSellingPrice(String(sale.sellingPrice || ""));
      setNotes(sale.notes || "");
      setReason("");
      setError("");
    }
  }, [visible, sale]);

  if (!visible || !sale) return null;

  const handleSave = async () => {
    const qty = parseFloat(quantity);
    const price = parseFloat(sellingPrice);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError(t("enterValidQuantityError"));
      return;
    }
    if (!sellingPrice || isNaN(price) || price <= 0) {
      setError(t("enterValidSellingPriceError"));
      return;
    }
    setSaving(true);
    try {
      const result = await salesService.editSale(sale.id, {
        quantity: qty,
        sellingPrice: price,
        notes: notes.trim(),
        reason: reason.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Edit sale error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("editSaleTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
        </div>

        <div style={styles.previousInfo}>
          <div style={styles.productName}>{sale.productName}</div>
          <div style={styles.previousLine}>
            {t("previousSaleInfo", {
              qty: sale.quantity,
              price: formatTZS(sale.sellingPrice),
            })}
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("tableQuantity")}</label>
        <FormattedNumberInput
          style={styles.input}
          value={quantity}
          onChange={setQuantity}
        />

        <label style={styles.label}>{t("sellingPriceLabel")}</label>
        <FormattedNumberInput
          style={styles.input}
          value={sellingPrice}
          onChange={setSellingPrice}
        />

        <label style={styles.label}>{t("additionalNotesLabel")}</label>
        <textarea
          style={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        <label style={styles.label}>{t("editReasonLabel")}</label>
        <input
          style={styles.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("editReasonPlaceholder")}
        />

        <div style={styles.warningBox}>{t("editSaleWarning")}</div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} disabled={saving} onClick={handleSave}>
            {saving ? t("completing") : t("saveChangesButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 55,
  },
  modal: {
    width: 420,
    maxHeight: "85vh",
    overflow: "auto",
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: 800 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  previousInfo: {
    background: "var(--bg)",
    borderRadius: 14,
    padding: "12px 14px",
    marginBottom: 16,
  },
  productName: { fontSize: 14, fontWeight: 700 },
  previousLine: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "var(--text-primary)",
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  textarea: {
    width: "100%",
    padding: "11px 13px",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
    resize: "none",
    fontFamily: "inherit",
  },
  warningBox: {
    fontSize: 11,
    color: "var(--warning)",
    background: "var(--warning-light)",
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 18,
    lineHeight: 1.5,
  },
  actions: { display: "flex", gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  saveBtn: {
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

export default EditSaleModal;


