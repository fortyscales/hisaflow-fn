import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const SupplierCard = ({ supplier, onPay, onDelete }) => {
  const { t } = useLanguage();
  const owed = supplier.totalSupplied - supplier.totalPaid;

  return (
    <div className="hf-card" style={styles.card}>
      <div style={styles.header}>
        <div style={{ flex: 1 }}>
          <div style={styles.name}>{supplier.name}</div>
          {supplier.phone && <div style={styles.phone}>{supplier.phone}</div>}
        </div>
        <button style={styles.deleteBtn} onClick={() => onDelete(supplier.id)}>
          {t("deleteButton")}
        </button>
      </div>

      <div style={styles.row}>
        <span style={styles.rowLabel}>{t("totalSuppliedLabel")}</span>
        <span style={styles.rowValue}>{formatTZS(supplier.totalSupplied)}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.rowLabel}>{t("amountPaidLabel")}</span>
        <span style={styles.rowValue}>{formatTZS(supplier.totalPaid)}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.rowLabel}>{t("remainingDebtLabel")}</span>
        <span
          style={{
            ...styles.rowValue,
            color: owed > 0 ? "var(--danger)" : "var(--success)",
            fontWeight: 800,
          }}
        >
          {formatTZS(owed)}
        </span>
      </div>

      {owed > 0 && (
        <button style={styles.payBtn} onClick={() => onPay(supplier)}>
          {t("paySupplierButton")}
        </button>
      )}
    </div>
  );
};

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: 18,
    padding: 20,
    border: "1px solid var(--border-muted)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  name: { fontSize: 15, fontWeight: 700 },
  phone: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  deleteBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 12,
  },
  row: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  rowLabel: { fontSize: 13, color: "var(--text-secondary)" },
  rowValue: { fontSize: 13, fontWeight: 700 },
  payBtn: {
    width: "100%",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
};

export default SupplierCard;


