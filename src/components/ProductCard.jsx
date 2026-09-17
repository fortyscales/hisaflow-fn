import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const getExpiryInfo = (expiryDate) => {
  if (!expiryDate) return null;
  const days = Math.ceil(
    (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0)
    return {
      label: "expired",
      color: "var(--danger)",
      bg: "var(--danger-light)",
    };
  if (days <= 30)
    return {
      label: "soon",
      color: "var(--warning)",
      bg: "var(--warning-light)",
    };
  return null;
};

const ProductCard = ({
  product,
  onEdit,
  onDelete,
  onQuickSell,
  onAddToCart,
  onAddStock,
  onAddToRestockCart,
  onViewBatches,
  lowStockThreshold = 10,
  selectMode,
  isSelected,
  onToggleSelect,
}) => {
  const { t } = useLanguage();
  const stock = product.stock || 0;
  const isOut = stock === 0;
  const isLow = !isOut && stock <= lowStockThreshold;
  const statusColor = isOut
    ? "var(--danger)"
    : isLow
      ? "var(--warning)"
      : "var(--success)";
  const profitPerUnit =
    (product.sellingPrice || 0) - (product.buyingPrice || 0);
  const expiryInfo = getExpiryInfo(product.expiryDate);

  return (
    <div
      className="hf-card"
      style={{
        ...styles.card,
        ...(selectMode && isSelected ? styles.cardSelected : {}),
      }}
    >
      <div style={styles.headerRow}>
        <div style={styles.identity}>
          {selectMode && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect(product.id)}
              style={styles.checkbox}
            />
          )}
          {product.imageUri ? (
            <img src={product.imageUri} alt="" style={styles.thumb} />
          ) : (
            <div style={styles.thumbFallback}>
              <span style={{ ...styles.statusDot, background: statusColor }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.name}>{product.name}</div>
            {(product.category || product.brand) && (
              <div style={styles.category}>
                {[product.brand, product.category].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.textLink} onClick={() => onEdit(product)}>
            {t("editButton")}
          </button>
          <button
            style={{ ...styles.textLink, color: "var(--danger)" }}
            onClick={() => onDelete(product.id)}
          >
            {t("deleteButton")}
          </button>
        </div>
      </div>

      {expiryInfo && (
        <div
          style={{
            ...styles.expiryBadge,
            background: expiryInfo.bg,
            color: expiryInfo.color,
          }}
        >
          {expiryInfo.label === "expired"
            ? t("expiredLabel")
            : t("expiringSoonLabel")}
        </div>
      )}

      <div style={styles.infoRow}>
        <span style={styles.profitLabel}>
          {t("profitPerUnit")}{" "}
          <strong
            style={{
              color:
                profitPerUnit >= 0 ? "var(--primary-dark)" : "var(--danger)",
            }}
          >
            {formatTZS(Math.abs(profitPerUnit))}
          </strong>
        </span>
        <span
          style={{
            ...styles.stockText,
            color: statusColor,
            ...(onViewBatches ? styles.stockTextClickable : {}),
          }}
          onClick={onViewBatches ? () => onViewBatches(product) : undefined}
          title={onViewBatches ? t("viewBatchesTooltip") : undefined}
        >
          {stock} {product.unit}
        </span>
      </div>

      <div style={styles.secondaryRow}>
        <button style={styles.secondaryBtn} onClick={() => onAddStock(product)}>
          {t("addStockButton")}
        </button>
        <button
          style={styles.secondaryBtn}
          onClick={() => onAddToRestockCart(product)}
        >
          {t("restockShortLabel")}
        </button>
        <button
          style={{ ...styles.secondaryBtn, opacity: isOut ? 0.4 : 1 }}
          disabled={isOut}
          onClick={() => onAddToCart(product)}
        >
          {t("cartShortLabel")}
        </button>
      </div>

      <button
        style={{ ...styles.sellBtn, opacity: isOut ? 0.4 : 1 }}
        disabled={isOut}
        onClick={() => onQuickSell(product)}
      >
        {t("sellButton")}
      </button>
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
  cardSelected: {
    border: "1.5px solid var(--primary)",
    background: "var(--primary-light)",
  },
  checkbox: { width: 18, height: 18, flexShrink: 0, cursor: "pointer" },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    objectFit: "cover",
    flexShrink: 0,
  },
  thumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: "var(--bg)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: { width: 9, height: 9, borderRadius: 999 },
  name: {
    fontSize: 16,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  category: { fontSize: 12, color: "var(--text-muted)", marginTop: 3 },
  headerActions: { display: "flex", gap: 14, flexShrink: 0, paddingTop: 2 },
  textLink: {
    background: "none",
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  expiryBadge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 11px",
    borderRadius: 999,
    marginBottom: 14,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  profitLabel: { fontSize: 13, color: "var(--text-muted)" },
  stockText: { fontSize: 13, fontWeight: 700 },
  stockTextClickable: {
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
  },
  secondaryRow: { display: "flex", gap: 8, marginBottom: 10 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 10,
    border: "1px solid var(--border-muted)",
    background: "var(--bg)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12.5,
    padding: "10px 0",
  },
  sellBtn: {
    width: "100%",
    borderRadius: 10,
    border: "none",
    padding: "12px 0",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
  },
};

export default ProductCard;


