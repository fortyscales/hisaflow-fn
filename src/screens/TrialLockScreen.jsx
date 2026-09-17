import React, { useState } from "react";
import { dataService } from "../services/DataService";
import { useLanguage } from "../context/LanguageContext.jsx";

// Shown instead of the entire app once the trial has run out and no
// license has been entered — this locks the app itself, never the
// underlying data. Every sale, product, and credit record made during
// the trial stays exactly where it is in the local database, untouched,
// ready the moment a valid key is entered.
const TrialLockScreen = ({ machineId, onActivated }) => {
  const { t } = useLanguage();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleActivate = async () => {
    if (!key.trim()) {
      setError(t("enterLicenseKeyError"));
      return;
    }
    setActivating(true);
    setError("");
    try {
      const result = await dataService.activateLicense(key.trim());
      if (!result.success) {
        setError(result.error);
        return;
      }
      onActivated();
    } catch (err) {
      console.error("License activation error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setActivating(false);
    }
  };

  const handleCopyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard access can fail in some environments — not worth
      // blocking the flow over, the ID is still shown and selectable.
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>{t("trialEndedTitle")}</h1>
        <p style={styles.subtitle}>{t("trialEndedSubtitle")}</p>

        <div style={styles.machineIdBox}>
          <div style={styles.machineIdLabel}>
            {t("yourActivationCodeLabel")}
          </div>
          <div style={styles.machineIdValue}>{machineId}</div>
          <button style={styles.copyBtn} onClick={handleCopyMachineId}>
            {copied ? t("copiedLabel") : t("copyCodeButton")}
          </button>
        </div>

        <p style={styles.hint}>{t("sendCodeHint")}</p>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("licenseKeyLabel")}</label>
        <input
          style={styles.input}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t("licenseKeyPlaceholder")}
          autoFocus
        />

        <button
          style={styles.activateBtn}
          disabled={activating}
          onClick={handleActivate}
        >
          {activating ? t("completing") : t("activateButton")}
        </button>
      </div>
    </div>
  );
};

const styles = {
  wrap: {
    position: "fixed",
    inset: 0,
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  card: {
    width: 440,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 32,
    boxShadow: "0 8px 40px rgba(41,37,34,0.15)",
  },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 22,
    lineHeight: 1.5,
  },
  machineIdBox: {
    background: "var(--bg)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    border: "1px solid var(--border-muted)",
  },
  machineIdLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 6,
  },
  machineIdValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-primary)",
    fontFamily: "monospace",
    wordBreak: "break-all",
    marginBottom: 10,
  },
  copyBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  hint: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginBottom: 20,
    lineHeight: 1.5,
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
    padding: "12px 14px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 16,
    letterSpacing: "0.05em",
    background: "var(--bg)",
    color: "var(--text-primary)",
    textAlign: "center",
  },
  activateBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default TrialLockScreen;


