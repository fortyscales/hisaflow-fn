import React, { useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { staffService } from "../services/staffService";
import OnboardingWizard from "../components/OnboardingWizard.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";

const LoginScreen = ({ onUnlock }) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login"); // login | recover-answer | recover-newpin
  const [answer, setAnswer] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");

  useEffect(() => {
    dataService.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleUnlock = async () => {
    setError("");
    try {
      const identity = await staffService.identifyByPin(pin, settings.ownerPin);
      if (identity) {
        onUnlock(settings, identity);
      } else {
        setError(t("incorrectPin"));
        setPin("");
      }
    } catch (err) {
      console.error("Unlock error:", err);
      setError(t("unexpectedErrorTryAgain"));
    }
  };

  const handleCheckAnswer = () => {
    setError("");
    if (!answer.trim()) {
      setError(t("enterYourAnswerError"));
      return;
    }
    // Case/whitespace-insensitive on purpose — this is a convenience
    // recovery gate for a small local business app, not a bank-grade check.
    const storedAnswer = (settings.securityQuestion?.answer || "")
      .trim()
      .toLowerCase();
    const givenAnswer = answer.trim().toLowerCase();
    if (storedAnswer && givenAnswer === storedAnswer) {
      setMode("recover-newpin");
      setAnswer("");
    } else {
      setError(t("incorrectAnswer"));
    }
  };

  const handleResetPin = async () => {
    setError("");
    if (newPin.length < 4) {
      setError(t("pinTooShort"));
      return;
    }
    if (newPin !== confirmNewPin) {
      setError(t("pinMismatch"));
      return;
    }
    try {
      const result = await dataService.resetOwnerPin(newPin);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSettings(result.settings);
      setNewPin("");
      setConfirmNewPin("");
      setMode("login");
    } catch (err) {
      console.error("Reset PIN error:", err);
      setError(t("unexpectedErrorTryAgain"));
    }
  };

  if (loading) return <LoadingState />;

  const isFirstRun = !settings.ownerPin;

  if (isFirstRun) {
    return <OnboardingWizard onComplete={onUnlock} />;
  }

  if (mode === "recover-answer") {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.title}>{t("recoverPinTitle")}</h1>

          {error && <div style={styles.error}>{error}</div>}

          {settings.securityQuestion?.question ? (
            <>
              <p style={styles.subtitle}>
                {settings.securityQuestion.question}
              </p>
              <input
                style={styles.input}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t("yourAnswerPlaceholder")}
                autoFocus
                onKeyUp={(e) => e.key === "Enter" && handleCheckAnswer()}
              />
              <button style={styles.button} onClick={handleCheckAnswer}>
                {t("continueButton")}
              </button>
            </>
          ) : (
            <p style={styles.subtitle}>{t("noRecoveryMethod")}</p>
          )}

          <button
            style={styles.linkButton}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            {t("backButton")}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "recover-newpin") {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.title}>{t("setNewPinTitle")}</h1>

          {error && <div style={styles.error}>{error}</div>}

          <input
            type="password"
            inputMode="numeric"
            placeholder={t("newPinPlaceholder")}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            style={styles.input}
            autoFocus
          />
          <input
            type="password"
            inputMode="numeric"
            placeholder={t("confirmPinPlaceholder")}
            value={confirmNewPin}
            onChange={(e) => setConfirmNewPin(e.target.value)}
            style={styles.input}
            onKeyUp={(e) => e.key === "Enter" && handleResetPin()}
          />
          <button style={styles.button} onClick={handleResetPin}>
            {t("saveNewPinButton")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>HisaFlow</h1>
        <p style={styles.subtitle}>{t("unlockPinTitle")}</p>

        {error && <div style={styles.error}>{error}</div>}

        <input
          type="password"
          inputMode="numeric"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ ...styles.input, textAlign: "center", letterSpacing: "6px" }}
          autoFocus
          onKeyUp={(e) => e.key === "Enter" && handleUnlock()}
        />
        <button style={styles.button} onClick={handleUnlock}>
          {t("loginButton")}
        </button>
        <button
          style={styles.linkButton}
          onClick={() => setMode("recover-answer")}
        >
          {t("forgotPin")}
        </button>
      </div>
    </div>
  );
};

const styles = {
  wrap: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
  },
  card: {
    width: 360,
    background: "var(--surface)",
    borderRadius: 24,
    padding: "40px 32px",
    border: "1px solid var(--border-muted)",
    boxShadow: "0 1px 3px rgba(41, 37, 34, 0.08)",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: "-0.02em",
    marginTop: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    textAlign: "center",
    margin: "8px 0 24px",
  },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border: "2px solid var(--border)",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  button: {
    width: "100%",
    padding: 15,
    border: "none",
    borderRadius: 14,
    background: "var(--primary)",
    color: "white",
    fontSize: 15,
    fontWeight: 800,
  },
  linkButton: {
    width: "100%",
    padding: "10px 0 0",
    border: "none",
    background: "none",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
};

export default LoginScreen;


