import React, { useMemo } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// Orders waiting at the cashier — a real signal that's easy to lose
// track of once a shop has more than a couple written up at once, since
// nothing else in the app surfaces "these are still open" on its own.
const PendingOrdersBanner = ({ orders, onPress }) => {
  const { t } = useLanguage();

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "pending").length,
    [orders],
  );

  if (pendingCount === 0) return null;

  return (
    <button style={styles.banner} onClick={onPress}>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={styles.title}>{t("pendingOrdersTitle")}</div>
        <div style={styles.subtitle}>
          {t("pendingOrdersSummary", { count: pendingCount })}
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

export default PendingOrdersBanner;


