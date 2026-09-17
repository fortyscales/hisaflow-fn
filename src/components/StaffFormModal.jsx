import React, { useState, useEffect } from "react";
import {
  PERMISSION_KEYS,
  emptyPermissions,
  fullPermissions,
} from "../services/staffService";
import { useLanguage } from "../context/LanguageContext.jsx";

const PERMISSION_LABELS = {
  manageProducts: "permManageProducts",
  manageSales: "permManageSales",
  manageCredit: "permManageCredit",
  manageExpenses: "permManageExpenses",
  manageSuppliers: "permManageSuppliers",
  manageStaff: "permManageStaff",
  manageSettings: "permManageSettings",
};

const StaffFormModal = ({ visible, editingStaff, onSave, onClose }) => {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingStaff) {
      setName(editingStaff.name || "");
      setPin(editingStaff.pin || "");
      setPermissions(editingStaff.permissions || emptyPermissions());
    } else {
      setName("");
      setPin("");
      setPermissions(emptyPermissions());
    }
    setError("");
  }, [editingStaff, visible]);

  if (!visible) return null;

  const isFullAccess = PERMISSION_KEYS.every((key) => permissions[key]);

  const togglePermission = (key) =>
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleFullAccess = () =>
    setPermissions(isFullAccess ? emptyPermissions() : fullPermissions());

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await onSave({ name, pin, permissions });
      if (!result.success) setError(result.error);
    } catch (err) {
      console.error("Staff save error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>
          {editingStaff ? t("editStaffTitle") : t("addStaffTitle")}
        </h2>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("staffNameLabel")}</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label style={styles.label}>{t("staffPinLabel")}</label>
        <input
          style={styles.input}
          type="text"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
        />
        <div style={styles.hint}>{t("staffPinHint")}</div>

        <div style={styles.fullAccessRow} onClick={toggleFullAccess}>
          <div>
            <div style={styles.fullAccessTitle}>{t("fullAccessLabel")}</div>
            <div style={styles.fullAccessSub}>{t("fullAccessHint")}</div>
          </div>
          <div
            style={{
              ...styles.toggle,
              ...(isFullAccess ? styles.toggleOn : {}),
            }}
          >
            <div
              style={{
                ...styles.toggleKnob,
                ...(isFullAccess ? styles.toggleKnobOn : {}),
              }}
            />
          </div>
        </div>

        <div style={styles.permList}>
          {PERMISSION_KEYS.map((key) => (
            <div
              key={key}
              style={styles.permRow}
              onClick={() => togglePermission(key)}
            >
              <span style={styles.permLabel}>{t(PERMISSION_LABELS[key])}</span>
              <div
                style={{
                  ...styles.toggle,
                  ...(permissions[key] ? styles.toggleOn : {}),
                }}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    ...(permissions[key] ? styles.toggleKnobOn : {}),
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
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
    width: 440,
    maxHeight: "88vh",
    overflow: "auto",
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
    marginBottom: 6,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  hint: { fontSize: 11, color: "var(--text-muted)", marginBottom: 18 },
  fullAccessRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--primary-light)",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 16,
    cursor: "pointer",
  },
  fullAccessTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "var(--primary-dark)",
  },
  fullAccessSub: {
    fontSize: 11,
    color: "var(--primary-dark)",
    opacity: 0.8,
    marginTop: 2,
  },
  permList: { marginBottom: 20 },
  permRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "11px 4px",
    borderBottom: "1px solid var(--border-muted)",
    cursor: "pointer",
  },
  permLabel: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" },
  toggle: {
    width: 38,
    height: 22,
    borderRadius: 999,
    background: "var(--border)",
    padding: 2,
    flexShrink: 0,
  },
  toggleOn: { background: "var(--primary)" },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "white",
    transition: "transform 0.15s ease",
  },
  toggleKnobOn: { transform: "translateX(16px)" },
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

export default StaffFormModal;


