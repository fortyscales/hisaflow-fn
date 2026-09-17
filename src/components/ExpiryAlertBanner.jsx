import React from "react";
import { alertService } from "../services/alertService.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const ExpiryAlertBanner = ({ products, warningDays = 30, onPress }) => {
  const { t } = useLanguage();
  const { expired, expiringSoon } = alertService.getExpiryAlerts(
    products,
    warningDays,
  );

  if (expired.length === 0 && expiringSoon.length === 0) return null;

  const parts = [];
  if (expired.length > 0)
    parts.push(t("expiredCount", { count: expired.length }));
  if (expiringSoon.length > 0)
    parts.push(t("expiringSoonCount", { count: expiringSoon.length }));

  return (
    <button style={styles.banner} onClick={onPress}>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={styles.title}>{t("expiryAlertTitle")}</div>
        <div style={styles.subtitle}>
          {parts.join(" · ")}. {t("tapToView")}
        </div>
      </div>
      <span style={styles.chevron}>›</span>
    </button>
  );
};

const styles = {
  banner: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "var(--warning-light)",
    border: "1px solid var(--warning)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    cursor: "pointer",
  },
  title: { fontSize: 13, fontWeight: 700, color: "var(--warning)" },
  subtitle: { fontSize: 12, color: "var(--warning)", marginTop: 2 },
  chevron: { fontSize: 18, color: "var(--warning)", flexShrink: 0 },
};

export default ExpiryAlertBanner;


