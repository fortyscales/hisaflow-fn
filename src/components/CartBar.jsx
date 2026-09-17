import React from "react";
import { useCart } from "../context/CartContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// No fixed positioning here — the parent screen stacks this inside a
// flex column anchored to the bottom of the content area. That's what
// lets this and RestockCartBar coexist without either one needing to
// know the other's height in advance.
const CartBar = ({ onOpenCart }) => {
  const { totalItems, totalAmount } = useCart();
  const { t } = useLanguage();

  if (totalItems === 0) return null;

  return (
    <button style={styles.bar} onClick={onOpenCart}>
      <div style={styles.left}>
        <div style={styles.badge}>{totalItems}</div>
        <span style={styles.label}>{t("itemsInCart")}</span>
      </div>
      <div style={styles.right}>
        <span style={styles.total}>{formatTZS(totalAmount)}</span>
        <span style={styles.cta}>{t("viewCart")}</span>
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
    borderLeft: "4px solid var(--primary)",
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
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  label: { color: "var(--text-primary)", fontSize: 13, fontWeight: 600 },
  right: { display: "flex", alignItems: "center", gap: 16 },
  total: { color: "var(--text-primary)", fontSize: 16, fontWeight: 800 },
  cta: { color: "var(--primary-dark)", fontSize: 13, fontWeight: 700 },
};

export default CartBar;


