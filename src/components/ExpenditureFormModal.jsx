import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import FormattedNumberInput from "./FormattedNumberInput.jsx";

const ExpenditureFormModal = ({ visible, onSave, onClose, paymentAccounts = [] }) => {
  const { t } = useLanguage();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("operational");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountId, setAccountId] = useState("");

  if (!visible) return null;

  const handleSave = async () => {
    if (!description.trim()) {
      setError(t("enterExpenditureDescriptionError"));
      return;
    }
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setError(t("enterValidAmountError"));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        description: description.trim(),
        amount: amt,
        type,
        date: new Date().toISOString(),
        accountId: accountId || null,
        accountLabel: paymentAccounts.find(a=>a.id===accountId)?.label || "",
        accountNumber: paymentAccounts.find(a=>a.id===accountId)?.accountNumber || "",
      });
      setDescription("");
      setAmount("");
      setType("operational");
      setAccountId("");
      setError("");
    } catch (err) {
      console.error("Expenditure save error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setDescription("");
    setAmount("");
    setType("operational");
    setError("");
    setSaving(false);
    onClose();
  };

  const TYPE_OPTIONS = [
    { key: "operational", label: t("expenditureTypeOperational") },
    { key: "inventory", label: t("expenditureTypeInventory") },
    { key: "personal", label: t("expenditureTypePersonal") },
    { key: "other", label: t("expenditureTypeOther") },
  ];

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("addExpenditureTitle")}</h2>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("expenditureDescriptionLabel")}</label>
        <input
          style={styles.input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("expenditureDescriptionPlaceholder")}
          autoFocus
        />

        <label style={styles.label}>{t("expenditureAmountLabel")}</label>
        <FormattedNumberInput
          style={styles.input}
          value={amount}
          onChange={setAmount}
          placeholder="0"
        />

        <label style={styles.label}>{t("expenditureTypeLabel")}</label>
        <div style={styles.typeGrid}>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              style={{
                ...styles.typeOption,
                ...(type === opt.key ? styles.typeOptionActive : {}),
              }}
              onClick={() => setType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>


        <label style={styles.label}>{t("paidFromAccountLabel")}</label>
        <select style={styles.input} value={accountId} onChange={(e)=>setAccountId(e.target.value)}>
          <option value="">{t("cashNotTrackedOption")}</option>
          {paymentAccounts.map(a=><option key={a.id} value={a.id}>{a.label}{a.accountNumber ? ` · ${a.accountNumber}` : ""}</option>)}
        </select>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={handleClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} disabled={saving} onClick={handleSave}>
            {saving ? t("completing") : t("saveButton")}
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
    width: 400,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 18 },
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
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  actions: { display: "flex", gap: 10, marginTop: 4 },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 18,
  },
  typeOption: {
    padding: "9px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  typeOptionActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
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
    background: "var(--danger)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default ExpenditureFormModal;


