import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const StockAlertBanner = ({ products, threshold = 10, onPress }) => {
  const { t } = useLanguage();
  const outOfStock = products.filter((p) => (p.stock || 0) === 0);
  const lowStock = products.filter(
    (p) => (p.stock || 0) > 0 && (p.stock || 0) <= threshold,
  );

  if (outOfStock.length === 0 && lowStock.length === 0) return null;

  const parts = [];
  if (outOfStock.length > 0)
    parts.push(t("outOfStockCount", { count: outOfStock.length }));
  if (lowStock.length > 0)
    parts.push(t("lowStockCount", { count: lowStock.length }));

  return (
    <button style={styles.banner} onClick={onPress}>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={styles.title}>{t("stockAlertTitle")}</div>
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
    background: "var(--danger-light)",
    border: "1px solid var(--danger)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    cursor: "pointer",
  },
  title: { fontSize: 13, fontWeight: 700, color: "var(--danger)" },
  subtitle: { fontSize: 12, color: "var(--danger)", marginTop: 2 },
  chevron: { fontSize: 18, color: "var(--danger)", flexShrink: 0 },
};

export default StockAlertBanner;


