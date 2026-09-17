import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// The dots-and-lines progress UI shared by every multi-step flow in the
// app — product creation, cart checkout, Excel import. Built after the
// same JSX (byte-for-byte identical in two of the three places it lived)
// had been copy-pasted three separate times, which is exactly how small,
// easy-to-miss inconsistencies creep in over time even when nothing is
// actually broken yet.
const StepIndicator = ({
  steps,
  currentStep,
  stepLabel,
  showStepCount = false,
}) => {
  const { t } = useLanguage();

  return (
    <>
      <div style={styles.stepRow}>
        {steps.map((key, i) => (
          <React.Fragment key={key}>
            <div
              style={{
                ...styles.stepDot,
                ...(i <= currentStep ? styles.stepDotActive : {}),
              }}
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  ...styles.stepLine,
                  ...(i < currentStep ? styles.stepLineActive : {}),
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={styles.stepIndicatorText}>
        {showStepCount
          ? t("stepIndicator", {
              step: currentStep + 1,
              total: steps.length,
              label: stepLabel(currentStep),
            })
          : stepLabel(currentStep)}
      </div>
    </>
  );
};

const styles = {
  stepRow: { display: "flex", alignItems: "center", marginBottom: 8 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: "var(--border-muted)",
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  stepDotActive: { background: "var(--primary)", color: "white" },
  stepLine: {
    flex: 1,
    height: 2,
    background: "var(--border-muted)",
    margin: "0 4px",
  },
  stepLineActive: { background: "var(--primary)" },
  stepIndicatorText: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textAlign: "center",
    marginBottom: 18,
  },
};

export default StepIndicator;


