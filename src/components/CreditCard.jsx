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

const statusStyle = (status) => {
  if (status === "paid")
    return { bg: "var(--success-light)", text: "var(--success)" };
  if (status === "partial")
    return { bg: "var(--warning-light)", text: "var(--warning)" };
  return { bg: "var(--danger-light)", text: "var(--danger)" };
};

const itemSummary = (creditSale) => {
  const items = creditSale.items || [];
  if (items.length === 0) return "";
  if (items.length === 1) return items[0].productName;
  return `${items[0].productName} +${items.length - 1} zaidi`;
};

const CreditCard = ({ creditSale, onPayment, onDelete, onRemindCustomer }) => {
  const { t } = useLanguage();
  const remaining = creditSale.totalAmount - creditSale.amountPaid;
  const status = statusStyle(creditSale.status);

  const statusLabel = (s) => {
    if (s === "paid") return t("statusPaid");
    if (s === "partial") return t("statusPartial");
    return t("statusPending");
  };

  return (
    <div className="hf-card" style={styles.card}>
      <div style={styles.header}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={styles.customerName}>{creditSale.customerName}</div>
          <div style={styles.summary}>{itemSummary(creditSale)}</div>
          {creditSale.actorName && (
            <div style={styles.summary}>
              {t("soldByLabel")}: {creditSale.actorName}
            </div>
          )}
        </div>
        <div style={{ ...styles.statusBadge, background: status.bg }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: status.text }}>
            {statusLabel(creditSale.status)}
          </span>
        </div>
      </div>

      <div style={styles.itemsBox}>
        {(creditSale.items || []).map((item, idx) => (
          <div key={idx} style={styles.row}>
            <span style={styles.rowLabel}>
              {item.productName} ({item.quantity})
              {(item.productBrand ||
                item.productCategory ||
                item.productSize) && (
                <span style={styles.itemMeta}>
                  {" "}
                  ·{" "}
                  {[item.productBrand, item.productCategory, item.productSize]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </span>
            <span style={styles.rowValue}>
              {formatTZS(item.sellingPrice * item.quantity)}
            </span>
          </div>
        ))}
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("tableTotal")}</span>
          <span style={styles.rowValue}>
            {formatTZS(creditSale.totalAmount)}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("amountPaidLabel")}</span>
          <span style={styles.rowValue}>
            {formatTZS(creditSale.amountPaid)}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("remainingDebtLabel")}</span>
          <span
            style={{
              ...styles.rowValue,
              color: "var(--danger)",
              fontWeight: 800,
            }}
          >
            {formatTZS(remaining)}
          </span>
        </div>
        {creditSale.customerPhone && (
          <div style={styles.row}>
            <span style={styles.rowLabel}>{t("customerPhoneLabel")}</span>
            <span style={styles.rowValue}>{creditSale.customerPhone}</span>
          </div>
        )}
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("tableDate")}</span>
          <span style={styles.rowValue}>{formatDate(creditSale.date)}</span>
        </div>
      </div>

      <div style={styles.actions}>
        {creditSale.customerPhone && onRemindCustomer && (
          <button
            style={styles.remindBtn}
            onClick={() => onRemindCustomer(creditSale)}
          >
            {t("sendReminderButton")}
          </button>
        )}
        {creditSale.status !== "paid" && (
          <button style={styles.payBtn} onClick={() => onPayment(creditSale)}>
            {t("recordPaymentButton")}
          </button>
        )}
        <button
          style={styles.deleteBtn}
          onClick={() => onDelete(creditSale.id)}
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
    marginBottom: 14,
  },
  customerName: { fontSize: 15, fontWeight: 700 },
  summary: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  statusBadge: { borderRadius: 999, padding: "5px 12px" },
  itemsBox: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 12,
    borderTop: "1px solid var(--border-muted)",
    marginBottom: 16,
  },
  row: { display: "flex", justifyContent: "space-between" },
  rowLabel: { fontSize: 13, color: "var(--text-secondary)" },
  itemMeta: { fontSize: 11, color: "var(--text-muted)" },
  rowValue: { fontSize: 13, fontWeight: 600 },
  actions: { display: "flex", gap: 8 },
  remindBtn: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  payBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
  deleteBtn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontWeight: 700,
    fontSize: 13,
  },
};

export default CreditCard;


