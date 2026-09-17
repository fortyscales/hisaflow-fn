import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("sw-TZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const paymentMethodLabel = (method, t) => {
  if (method === "cash") return t("cashMethodOption");
  if (method === "bank_transfer") return t("bankTransferMethodOption");
  if (method === "lipa_namba") return t("lipaNambaMethodOption");
  return "";
};

// Displays a single stock batch (lot) — one restock event with its own
// buying price. Used when the same product has been restocked multiple
// times at different prices, so it's clear exactly which batch is being
// sold from and why the average buying price looks the way it does.
const BatchCard = ({ batch, index, isOldestActive }) => {
  const { t } = useLanguage();

  const totalQty = batch.quantity || 0;
  const remaining = batch.remaining ?? totalQty;
  const percentRemaining = totalQty > 0 ? (remaining / totalQty) * 100 : 0;
  const batchValue = remaining * (batch.buyingPrice || 0);
  const isDepleted = remaining <= 0;

  return (
    <div
      className="hf-card"
      style={{ ...styles.card, ...(isDepleted ? styles.cardDepleted : {}) }}
    >
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              ...styles.badge,
              ...(isOldestActive ? styles.badgeActive : {}),
            }}
          >
            {isOldestActive
              ? t("currentlyUsingFifo")
              : t("batchNumberLabel", { n: index + 1 })}
          </span>
          {isDepleted && (
            <span style={styles.badgeDanger}>{t("depletedLabel")}</span>
          )}
        </div>
        <span style={styles.dateText}>{formatDate(batch.date)}</span>
      </div>

      {(batch.supplierName || batch.paymentMethod) && (
        <div style={styles.sourceLine}>
          {batch.supplierName && (
            <span>
              {t("fromSupplierLabel")} {batch.supplierName}
            </span>
          )}
          {batch.supplierName && batch.paymentMethod && " · "}
          {batch.paymentMethod && (
            // The specific account (e.g. "CRDB Business") when one was
            // picked at restock time — falls back to the generic method
            // label ("Bank Transfer") for batches recorded before this,
            // or restocks where no specific account was chosen.
            <span>
              {batch.accountLabel
                ? `${batch.accountLabel}${batch.accountNumber ? ` · ${batch.accountNumber}` : ""}`
                : paymentMethodLabel(batch.paymentMethod, t)}
            </span>
          )}
        </div>
      )}

      <div style={styles.statsRow}>
        <div style={styles.statCol}>
          <div style={styles.statLabel}>{t("buyingPrice")}</div>
          <div style={styles.statValue}>{formatTZS(batch.buyingPrice)}</div>
        </div>
        <div style={styles.statCol}>
          <div style={styles.statLabel}>{t("remainingLabel2")}</div>
          <div style={styles.statValue}>
            {remaining}/{totalQty}
          </div>
        </div>
        <div style={styles.statCol}>
          <div style={styles.statLabel}>{t("valueLabel")}</div>
          <div style={styles.statValue}>{formatTZS(batchValue)}</div>
        </div>
      </div>

      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.max(percentRemaining, isDepleted ? 0 : 3)}%`,
            background: isDepleted ? "var(--text-muted)" : "var(--primary)",
          }}
        />
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: 16,
    padding: 16,
    border: "1px solid var(--border-muted)",
    marginBottom: 10,
  },
  cardDepleted: { opacity: 0.55 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    background: "var(--bg)",
    borderRadius: 999,
    padding: "4px 10px",
  },
  badgeActive: {
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
  },
  badgeDanger: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--danger)",
    background: "var(--danger-light)",
    borderRadius: 999,
    padding: "4px 10px",
  },
  dateText: { fontSize: 11, color: "var(--text-muted)" },
  sourceLine: {
    fontSize: 11,
    color: "var(--text-secondary)",
    marginBottom: 10,
  },
  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statCol: { flex: 1, textAlign: "center" },
  statLabel: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: 700 },
  barTrack: {
    height: 6,
    background: "var(--border-muted)",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
};

export default BatchCard;


