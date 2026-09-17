import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("sw-TZ", {
    day: "numeric",
    month: "short",
  });
};

const CustomerCard = ({ customer, onOpen }) => {
  const { t } = useLanguage();

  return (
    <div
      className="hf-card"
      style={styles.card}
      onClick={() => onOpen(customer)}
    >
      <div style={styles.header}>
        <div style={styles.avatar}>
          {(customer.name || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.name}>{customer.name}</div>
          {customer.phone && <div style={styles.phone}>{customer.phone}</div>}
        </div>
        {customer.totalDebt > 0 && (
          <div style={styles.debtBadge}>{formatTZS(customer.totalDebt)}</div>
        )}
      </div>

      <div style={styles.row}>
        <span style={styles.rowLabel}>{t("totalSpentLabel")}</span>
        <span style={styles.rowValue}>{formatTZS(customer.totalSpent)}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.rowLabel}>{t("transactionCountLabel")}</span>
        <span style={styles.rowValue}>{customer.transactionCount}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.rowLabel}>{t("lastPurchaseLabel")}</span>
        <span style={styles.rowValue}>
          {formatDate(customer.lastPurchaseDate)}
        </span>
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: 18,
    padding: 20,
    border: "1px solid var(--border-muted)",
    cursor: "pointer",
  },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "var(--primary)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 800,
    flexShrink: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  phone: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  debtBadge: {
    fontSize: 12,
    fontWeight: 800,
    color: "var(--danger)",
    background: "var(--danger-light)",
    padding: "5px 10px",
    borderRadius: 999,
    flexShrink: 0,
  },
  row: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  rowLabel: { fontSize: 13, color: "var(--text-secondary)" },
  rowValue: { fontSize: 13, fontWeight: 700 },
};

export default CustomerCard;


