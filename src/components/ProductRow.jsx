import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import ProductIdentity from "./ProductIdentity.jsx";
import {
  MoreVertical,
  Pencil,
  Trash2,
  PackagePlus,
  ShoppingCart,
  Layers,
  ShoppingBag,
  Package,
} from "lucide-react";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Same 7 actions ProductCard already exposed (edit, delete, quick-sell,
// add stock, add to cart, add to restock cart, view batches) - a table
// row just can't lay them out inline the way a card could, so they're
// consolidated into one dropdown menu instead of removing any of them.
const ProductRow = ({
  index,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const stock = product.stock || 0;
  const isOut = stock === 0;
  const isLow = !isOut && stock <= lowStockThreshold;
  const statusLabel = isOut
    ? t("outOfStockBadge")
    : isLow
      ? t("lowStockBadgeLabel")
      : t("normalStockBadgeLabel");
  const statusStyle = isOut
    ? { background: "var(--danger-light)", color: "var(--danger)" }
    : isLow
      ? { background: "var(--warning-light)", color: "var(--warning)" }
      : { background: "var(--success-light)", color: "var(--success)" };

  const runAction = (fn) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <tr style={styles.row}>
      {selectMode && (
        <td style={styles.td}>
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect(product.id)}
            style={styles.checkbox}
          />
        </td>
      )}
      <td style={styles.td}>{index}</td>
      <td style={styles.td}>
        {product.imageUri ? (
          <img src={product.imageUri} alt="" style={styles.thumb} />
        ) : (
          <div style={styles.thumbFallback}>
            <Package size={16} color="var(--text-muted)" />
          </div>
        )}
      </td>
      <td style={styles.td}>
<ProductIdentity product={product} showCategory={false} compact />
      </td>
      <td style={styles.td}>
        <span style={styles.mutedText}>{product.category || "—"}</span>
      </td>
      <td style={styles.td}>{formatTZS(product.buyingPrice)}</td>
      <td style={styles.td}>{formatTZS(product.sellingPrice)}</td>
      <td style={styles.td}>
        <span
          style={onViewBatches ? styles.stockClickable : undefined}
          onClick={onViewBatches ? () => onViewBatches(product) : undefined}
          title={onViewBatches ? t("viewBatchesTooltip") : undefined}
        >
          {stock}
        </span>
      </td>
      <td style={styles.td}>{formatTZS(stock * (product.buyingPrice || 0))}</td>
      <td style={styles.td}>
        <span style={{ ...styles.statusBadge, ...statusStyle }}>
          {statusLabel}
        </span>
      </td>
      <td style={{ ...styles.td, position: "relative" }} ref={menuRef}>
        <button
          style={styles.menuTrigger}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreVertical size={16} color="var(--text-secondary)" />
        </button>
        {menuOpen && (
          <div style={styles.menu}>
            <button
              style={styles.menuItem}
              disabled={isOut}
              onClick={() => runAction(() => onQuickSell(product))}
            >
              <ShoppingBag size={14} /> {t("sellButton")}
            </button>
            <button
              style={styles.menuItem}
              onClick={() => runAction(() => onAddStock(product))}
            >
              <PackagePlus size={14} /> {t("addStockButton")}
            </button>
            <button
              style={styles.menuItem}
              onClick={() => runAction(() => onAddToRestockCart(product))}
            >
              <Layers size={14} /> {t("restockShortLabel")}
            </button>
            <button
              style={styles.menuItem}
              disabled={isOut}
              onClick={() => runAction(() => onAddToCart(product))}
            >
              <ShoppingCart size={14} /> {t("cartShortLabel")}
            </button>
            <div style={styles.menuDivider} />
            <button
              style={styles.menuItem}
              onClick={() => runAction(() => onEdit(product))}
            >
              <Pencil size={14} /> {t("editButton")}
            </button>
            <button
              style={{ ...styles.menuItem, color: "var(--danger)" }}
              onClick={() => runAction(() => onDelete(product.id))}
            >
              <Trash2 size={14} /> {t("deleteButton")}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

const styles = {
  row: { borderBottom: "1px solid var(--border-muted)" },
  td: { padding: "12px 14px", fontSize: 13, verticalAlign: "middle" },
  checkbox: { width: 16, height: 16, cursor: "pointer" },
  thumb: { width: 34, height: 34, borderRadius: 8, objectFit: "cover" },
  thumbFallback: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontWeight: 700, color: "var(--text-primary)" },
  sizeTag: { fontWeight: 600, color: "var(--text-muted)" },
  mutedText: { color: "var(--text-muted)" },
  stockClickable: {
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
  },
  statusBadge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
  },
  menuTrigger: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    right: 14,
    top: 40,
    zIndex: 20,
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(16,32,28,0.12)",
    padding: 6,
    minWidth: 170,
    display: "flex",
    flexDirection: "column",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontWeight: 600,
    fontSize: 12.5,
    textAlign: "left",
  },
  menuDivider: {
    height: 1,
    background: "var(--border-muted)",
    margin: "4px 2px",
  },
};

export default ProductRow;


