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
    hour: "2-digit",
    minute: "2-digit",
  });
};

const paymentMethodLabel = (method, t) => {
  if (method === "cash") return t("cashMethodOption");
  if (method === "bank_transfer") return t("bankTransferMethodOption");
  if (method === "lipa_namba") return t("lipaNambaMethodOption");
  return "";
};

const SaleCard = ({ sale, currentUser, onEdit, onDelete, onInvoice }) => {
  const { t } = useLanguage();
  const profit = sale.profit || 0;
  const isProfit = profit >= 0;
  const profitMarginPct =
    sale.totalRevenue > 0 ? (profit / sale.totalRevenue) * 100 : 0;
  // Cost and margin reveal the business's actual markup - an owner's
  // call to share with staff or not, so this defaults to visible only
  // when we genuinely know the viewer is the owner. Staying visible
  // when currentUser isn't passed at all (rather than hiding by
  // default) avoids silently breaking any other caller of this card
  // that hasn't been updated to pass it yet.
  const canSeeCostData = !currentUser || currentUser.isOwner;
  // The specific account (e.g. "CRDB Business") when the sale was
  // received into one — falls back to the generic method label ("Bank
  // Transfer") for a sale recorded as cash, or before accounts existed.
  const paidVia = sale.accountLabel
    ? `${sale.accountLabel}${sale.accountNumber ? ` · ${sale.accountNumber}` : ""}`
    : paymentMethodLabel(sale.paymentMethod, t);

  return (
    <div className="hf-card" style={styles.card}>
      <div style={styles.header}>
        <div style={styles.identity}>
          {sale.productImageUri ? (
            <img src={sale.productImageUri} alt="" style={styles.thumb} />
          ) : (
            <div style={styles.thumbFallback} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.productNameRow}>
              <div style={styles.productName}>{sale.productName}</div>
              {sale.recordType === "credit" && (
                <span style={styles.paidCreditBadge}>{t("paidCreditBadge")}</span>
              )}
            </div>
            {(sale.productBrand ||
              sale.productCategory ||
              sale.productSize) && (
              <div style={styles.productMeta}>
                {[sale.productBrand, sale.productCategory, sale.productSize]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {sale.actorName && (
              <div style={styles.productMeta}>
                {t("soldByLabel")}: {sale.actorName}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={styles.date}>{formatDate(sale.date)}</div>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            {onInvoice && (
              <button style={styles.editLink} onClick={() => onInvoice(sale)}>Invoice</button>
            )}
            {onEdit && (
              <button style={styles.editLink} onClick={() => onEdit(sale)}>
                {t("editButton")}
              </button>
            )}
            {onDelete && (
              <button
                style={{ ...styles.editLink, color: "var(--danger)" }}
                onClick={() => onDelete(sale)}
              >
                {t("deleteButton")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={styles.details}>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("tableQuantity")}</span>
          <span style={styles.rowValue}>
            {sale.quantity}
            {sale.productUnit ? ` ${sale.productUnit}` : ""}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("sellingPriceLabel")}</span>
          <span style={styles.rowValue}>{formatTZS(sale.sellingPrice)}</span>
        </div>
        {sale.buyingPrice != null && canSeeCostData && (
          <div style={styles.row}>
            <span style={styles.rowLabel}>{t("buyingPriceLabel")}</span>
            <span style={styles.rowValue}>{formatTZS(sale.buyingPrice)}</span>
          </div>
        )}
        {sale.discount > 0 && (
          <div style={styles.row}>
            <span style={styles.rowLabel}>{t("discountLabel")}</span>
            <span style={{ ...styles.rowValue, color: "var(--danger)" }}>
              −{formatTZS(sale.discount)}
            </span>
          </div>
        )}
        {paidVia && (
          <div style={styles.row}>
            <span style={styles.rowLabel}>{t("receivedViaLabel")}</span>
            <span style={styles.rowValue}>{paidVia}</span>
          </div>
        )}
      </div>

      <div style={styles.divider}>
        <div style={styles.row}>
          <span style={styles.rowLabel}>{t("tableTotal")}</span>
          <span style={styles.totalValue}>{formatTZS(sale.totalRevenue)}</span>
        </div>
        {canSeeCostData && (
          <>
            <div style={styles.row}>
              <span style={styles.rowLabel}>
                {isProfit ? t("profitLabel") : t("lossLabel")}
              </span>
              <span
                style={{
                  ...styles.totalValue,
                  color: isProfit ? "var(--success)" : "var(--danger)",
                }}
              >
                {formatTZS(Math.abs(profit))}
              </span>
            </div>
            <div style={styles.row}>
              <span style={styles.rowLabel}>{t("profitMarginLabel")}</span>
              <span
                style={{
                  ...styles.rowValue,
                  color: isProfit ? "var(--success)" : "var(--danger)",
                }}
              >
                {profitMarginPct.toFixed(1)}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  productNameRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  paidCreditBadge: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 7px",
    borderRadius: 999,
    background: "var(--success-light)",
    color: "var(--success)",
    whiteSpace: "nowrap",
  },
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
    marginBottom: 12,
  },
  productName: { fontSize: 15, fontWeight: 700 },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    objectFit: "cover",
    flexShrink: 0,
  },
  thumbFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "var(--bg)",
    flexShrink: 0,
  },
  productMeta: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  reference: { fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, fontVariantNumeric: "tabular-nums" },
  date: { fontSize: 12, color: "var(--text-muted)" },
  editLink: {
    background: "none",
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--primary-dark)",
    padding: 0,
  },
  details: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  row: { display: "flex", justifyContent: "space-between" },
  rowLabel: { fontSize: 13, color: "var(--text-secondary)" },
  rowValue: { fontSize: 13, fontWeight: 600 },
  divider: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 12,
    borderTop: "1px solid var(--border-muted)",
  },
  totalValue: { fontSize: 14, fontWeight: 800 },
};

export default SaleCard;


