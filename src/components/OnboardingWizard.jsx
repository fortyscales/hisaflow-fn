import React, { useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { backupService } from "../services/backupService";
import { ownerIdentity } from "../services/staffService";
import { useLanguage } from "../context/LanguageContext.jsx";

// Replaces the old two-field "set a PIN" first-run screen. The real gap
// this closes: restoring an existing account used to only be reachable
// from inside Settings — meaning if someone's computer died, they'd have
// to set up a throwaway new PIN, log in, then go find Restore. That's
// backwards. Restore is now a first-run choice, same as "new business."
const OnboardingWizard = ({ onComplete }) => {
  const { t, setLanguage } = useLanguage();
  const [step, setStep] = useState("choice"); // choice | businessInfo | pin | restore
  const [businessName, setBusinessName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("sw");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [useCustomQuestion, setUseCustomQuestion] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [restorePin, setRestorePin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const PRESET_QUESTIONS = [
    t("securityQ1"),
    t("securityQ2"),
    t("securityQ3"),
    t("securityQ4"),
  ];

  useEffect(() => {
    if (!selectedQuestion) setSelectedQuestion(PRESET_QUESTIONS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBusinessInfoNext = () => {
    setError("");
    if (!businessName.trim()) {
      setError(t("enterBusinessNameError"));
      return;
    }
    setStep("pin");
  };

  const handleFinishSetup = async () => {
    setError("");
    if (pin.length < 4) {
      setError(t("pinTooShort"));
      return;
    }
    if (pin !== confirmPin) {
      setError(t("pinMismatch"));
      return;
    }
    const question = useCustomQuestion
      ? customQuestion.trim()
      : selectedQuestion;
    if (!question) {
      setError(t("chooseOrWriteQuestion"));
      return;
    }
    if (!securityAnswer.trim()) {
      setError(t("enterSecurityAnswer"));
      return;
    }
    const newSettings = {
      businessName: businessName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerPin: pin,
      language: selectedLanguage,
      securityQuestion: {
        question,
        answer: securityAnswer.trim().toLowerCase(),
      },
    };
    setBusy(true);
    try {
      await dataService.saveSettings(newSettings);
      setLanguage(selectedLanguage, newSettings);
      onComplete(newSettings, ownerIdentity());
    } catch (err) {
      console.error("Onboarding save error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setError("");
    if (!ownerPhone.trim() || !restorePin) {
      setError(t("enterPhoneAndPinError"));
      return;
    }
    setBusy(true);
    try {
      const result = await backupService.fetchFromCloud(
        ownerPhone.trim(),
        restorePin,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      const restoredSettings = await dataService.getSettings();
      onComplete(restoredSettings, ownerIdentity());
    } catch (err) {
      console.error("Onboarding restore error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>HisaFlow</h1>

        {step === "choice" && (
          <>
            <p style={styles.subtitle}>{t("onboardingWelcomeSubtitle")}</p>
            <button
              style={styles.primaryButton}
              onClick={() => setStep("businessInfo")}
            >
              {t("startNewBusinessButton")}
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => setStep("restore")}
            >
              {t("restoreExistingAccountButton")}
            </button>
          </>
        )}

        {step === "businessInfo" && (
          <>
            <p style={styles.subtitle}>{t("businessInfoStepSubtitle")}</p>
            {error && <div style={styles.error}>{error}</div>}

            <input
              style={styles.input}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t("businessNameSettingsLabel")}
              autoFocus
            />
            <input
              style={styles.input}
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder={t("ownerPhoneLabel")}
            />
            <div style={styles.hint}>{t("ownerPhoneHint")}</div>

            <div style={styles.langRow}>
              <button
                style={{
                  ...styles.langOption,
                  ...(selectedLanguage === "sw" ? styles.langOptionActive : {}),
                }}
                onClick={() => setSelectedLanguage("sw")}
              >
                Kiswahili
              </button>
              <button
                style={{
                  ...styles.langOption,
                  ...(selectedLanguage === "en" ? styles.langOptionActive : {}),
                }}
                onClick={() => setSelectedLanguage("en")}
              >
                English
              </button>
            </div>

            <button
              style={styles.primaryButton}
              onClick={handleBusinessInfoNext}
            >
              {t("continueButton")}
            </button>
            <button
              style={styles.linkButton}
              onClick={() => {
                setStep("choice");
                setError("");
              }}
            >
              {t("backButton")}
            </button>
          </>
        )}

        {step === "pin" && (
          <>
            <p style={styles.subtitle}>{t("setupPinTitle")}</p>
            {error && <div style={styles.error}>{error}</div>}

            <input
              type="password"
              inputMode="numeric"
              placeholder={t("newPinPlaceholder")}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder={t("confirmPinPlaceholder")}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              style={styles.input}
            />

            <div style={styles.hint}>{t("securityQuestionSetupHint")}</div>

            <div style={styles.questionGrid}>
              {PRESET_QUESTIONS.map((q) => (
                <button
                  key={q}
                  style={{
                    ...styles.questionOption,
                    ...(!useCustomQuestion && selectedQuestion === q
                      ? styles.questionOptionActive
                      : {}),
                  }}
                  onClick={() => {
                    setSelectedQuestion(q);
                    setUseCustomQuestion(false);
                  }}
                >
                  {q}
                </button>
              ))}
              <button
                style={{
                  ...styles.questionOption,
                  ...(useCustomQuestion ? styles.questionOptionActive : {}),
                }}
                onClick={() => setUseCustomQuestion(true)}
              >
                {t("otherQuestion")}
              </button>
            </div>

            {useCustomQuestion && (
              <input
                style={styles.input}
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder={t("writeYourQuestion")}
              />
            )}

            <input
              style={styles.input}
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder={t("yourAnswerPlaceholder")}
              onKeyUp={(e) => e.key === "Enter" && handleFinishSetup()}
            />

            <button
              style={styles.primaryButton}
              disabled={busy}
              onClick={handleFinishSetup}
            >
              {busy ? t("completing") : t("startButton")}
            </button>
            <button
              style={styles.linkButton}
              onClick={() => {
                setStep("businessInfo");
                setError("");
              }}
            >
              {t("backButton")}
            </button>
          </>
        )}

        {step === "restore" && (
          <>
            <p style={styles.subtitle}>{t("restoreStepSubtitle")}</p>
            {error && <div style={styles.error}>{error}</div>}

            <input
              style={styles.input}
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder={t("ownerPhoneLabel")}
              autoFocus
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={restorePin}
              onChange={(e) => setRestorePin(e.target.value)}
              style={styles.input}
              onKeyUp={(e) => e.key === "Enter" && handleRestore()}
            />

            <button
              style={styles.primaryButton}
              disabled={busy}
              onClick={handleRestore}
            >
              {busy ? t("completing") : t("restoreFromCloudButton")}
            </button>
            <button
              style={styles.linkButton}
              onClick={() => {
                setStep("choice");
                setError("");
              }}
            >
              {t("backButton")}
            </button>
          </>
        )}
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
    width: 380,
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
  },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    textAlign: "center",
    margin: "8px 0 24px",
    lineHeight: 1.5,
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
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 12,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  hint: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginBottom: 16,
    marginTop: -6,
  },
  langRow: { display: "flex", gap: 8, marginBottom: 18 },
  langOption: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
  langOptionActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  questionGrid: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  questionOption: {
    padding: "7px 12px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 11,
  },
  questionOptionActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  primaryButton: {
    width: "100%",
    padding: 15,
    border: "none",
    borderRadius: 14,
    background: "var(--primary)",
    color: "white",
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 10,
  },
  secondaryButton: {
    width: "100%",
    padding: 15,
    borderRadius: 14,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontSize: 14,
    fontWeight: 700,
  },
  linkButton: {
    width: "100%",
    padding: 8,
    border: "none",
    background: "none",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
};

export default OnboardingWizard;


