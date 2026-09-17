import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// Replaces window.confirm() everywhere in the app. Native browser dialogs
// look jarring next to a designed interface — this is a small component,
// but it's one of those details that quietly signals "this was built with
// care" versus "this was thrown together."
const ConfirmModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  danger = true,
  busy = false,
  error,
  // Optional - when a placeholder is provided, shows a free-text field
  // for an optional reason and passes its current value back through
  // onConfirm(reasonText) instead of onConfirm(). Existing callers that
  // don't pass this see no change in behavior at all.
  reasonPlaceholder,
  reasonLabel,
}) => {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) setReason("");
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={styles.overlay} onClick={busy ? undefined : onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && <h2 style={styles.title}>{title}</h2>}
        <p style={styles.message}>{message}</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {reasonPlaceholder && (
          <div style={{ textAlign: "left" }}>
            {reasonLabel && (
              <label style={styles.reasonLabel}>{reasonLabel}</label>
            )}
            <input
              style={styles.reasonInput}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
            />
          </div>
        )}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} disabled={busy} onClick={onCancel}>
            {t("cancelButton")}
          </button>
          <button
            style={{
              ...styles.confirmBtn,
              ...(danger ? styles.confirmBtnDanger : {}),
            }}
            disabled={busy}
            onClick={() =>
              reasonPlaceholder ? onConfirm(reason.trim()) : onConfirm()
            }
          >
            {busy ? t("completing") : t("deleteButton")}
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
    zIndex: 70,
    animation: "fadeIn 0.15s ease",
  },
  modal: {
    width: 340,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    textAlign: "center",
    animation: "scaleIn 0.15s ease",
  },
  title: { fontSize: 16, fontWeight: 800, marginBottom: 6 },
  message: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: 22,
  },
  actions: { display: "flex", gap: 10 },
  errorBox: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 12,
    fontWeight: 600,
    padding: "9px 12px",
    borderRadius: 10,
    marginBottom: 14,
    textAlign: "left",
  },
  reasonLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "var(--text-primary)",
  },
  reasonInput: {
    width: "100%",
    padding: "11px 13px",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 18,
    background: "var(--bg)",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  confirmBtnDanger: { background: "var(--danger)" },
};

export default ConfirmModal;


