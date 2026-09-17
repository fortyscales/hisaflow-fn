import React from "react";
import { useRestockCart } from "../context/RestockCartContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Same reasoning as CartBar — no fixed positioning of its own, the
// parent screen's flex stack handles placement so this and CartBar can
// appear together without hardcoded offsets that assume each other's height.
const RestockCartBar = ({ onOpenCart }) => {
  const { totalItems, totalCost } = useRestockCart();
  const { t } = useLanguage();

  if (totalItems === 0) return null;

  return (
    <button style={styles.bar} onClick={onOpenCart}>
      <div style={styles.left}>
        <div style={styles.badge}>{totalItems}</div>
        <span style={styles.label}>{t("itemsInRestockCart")}</span>
      </div>
      <div style={styles.right}>
        <span style={styles.total}>{formatTZS(totalCost)}</span>
        <span style={styles.cta}>{t("viewRestockCart")}</span>
      </div>
    </button>
  );
};

const styles = {
  bar: {
    width: "100%",
    background: "var(--surface)",
    borderRadius: 16,
    padding: "14px 20px",
    borderLeft: "4px solid var(--accent)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 20px rgba(41,37,34,0.1)",
    animation: "slideUpFade 0.2s ease",
    pointerEvents: "auto",
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: "var(--accent-light)",
    color: "#8A5A1E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  label: { color: "var(--text-primary)", fontSize: 13, fontWeight: 600 },
  right: { display: "flex", alignItems: "center", gap: 16 },
  total: { color: "var(--text-primary)", fontSize: 16, fontWeight: 800 },
  cta: { color: "#8A5A1E", fontSize: 13, fontWeight: 700 },
};

export default RestockCartBar;


