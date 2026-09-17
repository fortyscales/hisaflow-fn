import React, { useState, useEffect, useCallback } from "react";
import { crashLogService } from "../services/crashLogService";
import ConfirmModal from "./ConfirmModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatDateTime = (dateString) => {
  const d = new Date(dateString);
  return (
    d.toLocaleDateString("sw-TZ") +
    " · " +
    d.toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })
  );
};

const CrashLogModal = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const data = await crashLogService.getLogs();
    setLogs(data);
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  if (!visible) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const result = await crashLogService.exportLogs();
      if (!result.success) setError(result.error);
    } catch (err) {
      console.error("Export crash log error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setDownloading(false);
    }
  };

  const handleClear = async () => {
    try {
      await crashLogService.clearLogs();
      setConfirmingClear(false);
      refresh();
    } catch (err) {
      console.error("Clear crash log error:", err);
      setError(t("unexpectedErrorTryAgain"));
      setConfirmingClear(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("errorReportsTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button
            style={styles.downloadBtn}
            disabled={downloading || logs.length === 0}
            onClick={handleDownload}
          >
            {downloading ? t("completing") : t("downloadReportButton")}
          </button>
          {logs.length > 0 && (
            <button
              style={styles.clearBtn}
              onClick={() => setConfirmingClear(true)}
            >
              {t("clearAllButton")}
            </button>
          )}
        </div>

        <div style={styles.list}>
          {logs.length === 0 ? (
            <div style={styles.emptyNote}>{t("noErrorsRecorded")}</div>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} style={styles.entry}>
                <div style={styles.entryMessage}>{entry.message}</div>
                {entry.context && (
                  <div style={styles.entryContext}>{entry.context}</div>
                )}
                <div style={styles.entryDate}>
                  {formatDateTime(entry.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        visible={confirmingClear}
        message={t("confirmClearErrorsMessage")}
        onConfirm={handleClear}
        onCancel={() => setConfirmingClear(false)}
      />
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
    width: 440,
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
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  actions: { display: "flex", gap: 8, marginBottom: 16 },
  downloadBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
  },
  clearBtn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 13,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  emptyNote: {
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "24px 0",
  },
  entry: {
    background: "var(--bg)",
    borderRadius: 12,
    padding: 14,
    border: "1px solid var(--border-muted)",
  },
  entryMessage: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 4,
  },
  entryContext: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 },
  entryDate: { fontSize: 11, color: "var(--text-muted)" },
};

export default CrashLogModal;


