import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const SupplierFormModal = ({ visible, onSave, onClose }) => {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("enterSupplierNameError"));
      return;
    }
    setSaving(true);
    try {
      const result = await onSave({ name: name.trim(), phone: phone.trim() });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setName("");
      setPhone("");
      setError("");
    } catch (err) {
      console.error("Supplier save error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName("");
    setPhone("");
    setError("");
    setSaving(false);
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("addSupplierTitle")}</h2>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("supplierNameLabel")}</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label style={styles.label}>{t("customerPhoneLabel")}</label>
        <input
          style={styles.input}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XX XXX XXX"
        />

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
    width: 380,
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

export default SupplierFormModal;


