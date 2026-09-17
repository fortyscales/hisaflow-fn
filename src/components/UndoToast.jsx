import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// A brief window to reverse a delete before it's actually written to the
// database — not a replacement for the confirmation dialog, but a second
// layer for the moment right after confirming, when a mistake is still
// cheap to catch. Deliberately doesn't show a countdown timer; the fixed
// duration is long enough to act on without needing to watch a clock.
const UndoToast = ({ visible, message, onUndo }) => {
  const { t } = useLanguage();
  if (!visible) return null;

  return (
    <div style={styles.toast}>
      <span style={styles.message}>{message}</span>
      <button style={styles.undoBtn} onClick={onUndo}>
        {t("undoButton")}
      </button>
    </div>
  );
};

const styles = {
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 20px",
    background: "var(--text-primary)",
    borderRadius: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    zIndex: 100,
  },
  message: { color: "white", fontSize: 13, fontWeight: 600 },
  undoBtn: {
    background: "none",
    border: "none",
    color: "var(--primary-light)",
    fontWeight: 800,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
};

export default UndoToast;


