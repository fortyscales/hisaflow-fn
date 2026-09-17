import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// Deliberately visible, not hidden — a disclosed trial with a clear
// countdown is standard practice. A silently-ticking, undisclosed limit
// is a different thing entirely, and not what this is.
const TrialBanner = ({ daysRemaining }) => {
  const { t } = useLanguage();
  const urgent = daysRemaining <= 3;

  return (
    <div style={{ ...styles.banner, ...(urgent ? styles.bannerUrgent : {}) }}>
      {t("trialDaysRemainingLabel", { count: daysRemaining })}
    </div>
  );
};

const styles = {
  banner: {
    display: "inline-block",
    marginTop: 8,
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: "var(--warning-light)",
    color: "var(--warning)",
  },
  bannerUrgent: { background: "var(--danger-light)", color: "var(--danger)" },
};

export default TrialBanner;


