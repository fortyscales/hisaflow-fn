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

const typeStyle = (type) => {
  if (type === "operational")
    return { bg: "var(--primary-light)", text: "var(--primary-dark)" };
  if (type === "inventory")
    return { bg: "var(--success-light)", text: "var(--success)" };
  if (type === "personal")
    return { bg: "var(--warning-light)", text: "var(--warning)" };
  return { bg: "var(--bg)", text: "var(--text-secondary)" };
};

const ExpenditureCard = ({ expenditure, onDelete }) => {
  const { t } = useLanguage();
  const style = typeStyle(expenditure.type);

  const typeLabel = (type) => {
    if (type === "operational") return t("expenditureTypeOperational");
    if (type === "inventory") return t("expenditureTypeInventory");
    if (type === "personal") return t("expenditureTypePersonal");
    return t("expenditureTypeOther");
  };

  return (
    <div className="hf-card" style={styles.card}>
      <div style={styles.header}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={styles.description}>{expenditure.description}</div>
          <div style={styles.meta}>{formatDate(expenditure.date)}</div>
          {(expenditure.accountLabel || expenditure.accountNumber) && (
            <div style={styles.account}>Paid from: {[expenditure.accountLabel, expenditure.accountNumber].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        <div style={styles.right}>
          <div style={styles.amount}>-{formatTZS(expenditure.amount)}</div>
          <div style={{ ...styles.typeBadge, background: style.bg }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: style.text }}>
              {typeLabel(expenditure.type)}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          style={styles.deleteBtn}
          onClick={() => onDelete(expenditure.id)}
        >
          {t("deleteButton")}
        </button>
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
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  description: { fontSize: 15, fontWeight: 700 },
  meta: { fontSize: 12, color: "var(--text-muted)", marginTop: 3 },
  account: { fontSize: 11, color: "var(--text-secondary)", marginTop: 7, fontWeight: 600 },
  right: { textAlign: "right" },
  amount: { fontSize: 14, fontWeight: 800, color: "var(--danger)" },
  typeBadge: {
    borderRadius: 999,
    padding: "4px 10px",
    marginTop: 6,
    display: "inline-block",
  },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 12 },
  deleteBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 12,
  },
};

export default ExpenditureCard;


