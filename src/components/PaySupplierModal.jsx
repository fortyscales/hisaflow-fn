import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import FormattedNumberInput from "./FormattedNumberInput.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

const PaySupplierModal = ({ visible, supplier, onSave, onClose }) => {
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!visible || !supplier) return null;

  const owed = supplier.totalSupplied - supplier.totalPaid;

  const handleSave = async () => {
    const amt = parseFloat(amount) || 0;
    setSaving(true);
    try {
      const result = await onSave(supplier.id, amt, paymentMethod);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAmount("");
      setPaymentMethod("cash");
      setError("");
    } catch (err) {
      console.error("Supplier payment error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("paySupplierButton")}</h2>
        <div style={styles.supplierName}>{supplier.name}</div>

        <div style={styles.owedBox}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t("remainingDebtLabel")}
          </span>
          <span
            style={{ fontSize: 18, fontWeight: 800, color: "var(--danger)" }}
          >
            {formatTZS(owed)}
          </span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("paymentAmountLabel")}</label>
        <FormattedNumberInput
          style={styles.input}
          value={amount}
          onChange={setAmount}
          placeholder="0"
          autoFocus
        />

        <label style={styles.label}>{t("paymentMethodLabel")}</label>
        <div style={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              style={{
                ...styles.methodChip,
                ...(paymentMethod === m.value ? styles.methodChipActive : {}),
              }}
              onClick={() => setPaymentMethod(m.value)}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} disabled={saving} onClick={handleSave}>
            {saving ? t("completing") : t("recordPaymentButton")}
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
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: 380,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 4 },
  supplierName: { fontSize: 13, color: "var(--text-muted)", marginBottom: 16 },
  owedBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--danger-light)",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 16,
  },
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
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 18,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  methodRow: { display: "flex", gap: 6, marginBottom: 18, marginTop: -8 },
  methodChip: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  methodChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  actions: { display: "flex", gap: 10 },
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

export default PaySupplierModal;


