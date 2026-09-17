import React, { useState } from "react";
import { reportService } from "../services/reportService";
import { useLanguage } from "../context/LanguageContext.jsx";

const PERIODS = ["today", "week", "month", "quarter", "year", "all"];

const ReportModal = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!visible) return null;

  const periodLabel = (p) => {
    if (p === "today") return t("periodToday");
    if (p === "week") return t("periodThisWeek");
    if (p === "month") return t("periodThisMonth");
    if (p === "quarter") return t("periodThisQuarter");
    if (p === "year") return t("periodThisYear");
    return t("periodSinceStart");
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const { startDate, endDate } = reportService.getDateRange(selectedPeriod);
      await reportService.generateReport({ startDate, endDate });
      onClose();
    } catch (err) {
      console.error("Report generation error:", err);
      setError(t("reportGenerationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("generateReportTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.label}>{t("choosePeriodLabel")}</div>
        <div style={styles.periodGrid}>
          {PERIODS.map((p) => (
            <button
              key={p}
              style={{
                ...styles.periodOption,
                ...(selectedPeriod === p ? styles.periodOptionActive : {}),
              }}
              onClick={() => setSelectedPeriod(p)}
            >
              {periodLabel(p)}
            </button>
          ))}
        </div>

        <div style={styles.explainer}>{t("reportContentsExplainer")}</div>

        <button
          style={styles.generateBtn}
          disabled={loading}
          onClick={handleGenerate}
        >
          {loading ? t("completing") : t("generateAndDownloadReport")}
        </button>
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
    zIndex: 60,
  },
  modal: {
    width: 420,
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
  label: { fontSize: 13, fontWeight: 700, marginBottom: 10 },
  periodGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  periodOption: {
    padding: "9px 16px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 13,
  },
  periodOptionActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  explainer: {
    fontSize: 12,
    color: "var(--text-secondary)",
    textAlign: "center",
    background: "var(--bg)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    lineHeight: 1.5,
  },
  generateBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default ReportModal;


