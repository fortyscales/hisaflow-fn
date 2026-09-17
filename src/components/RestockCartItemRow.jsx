import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import FormattedNumberInput from "./FormattedNumberInput.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Same reasoning as CartItemRow — both fields commit on blur/Enter via
// local state, rather than clamping on every keystroke. The old version
// bound the input directly to context and fell back to a default the
// instant the field was cleared to type a new number (parseFloat('') is
// NaN, so `|| 1` or `|| 0` fired on every empty keystroke) — meaning you
// could never actually clear the field to type something new.
const RestockCartItemRow = ({
  item,
  onUpdateQuantity,
  onUpdateBuyingPrice,
  onRemove,
}) => {
  const { t } = useLanguage();
  const [qtyInput, setQtyInput] = useState(String(item.quantity));
  const [priceInput, setPriceInput] = useState(String(item.buyingPrice));

  useEffect(() => {
    setQtyInput(String(item.quantity));
  }, [item.quantity]);
  useEffect(() => {
    setPriceInput(String(item.buyingPrice));
  }, [item.buyingPrice]);

  const commitQuantity = () => {
    const parsed = parseFloat(qtyInput);
    if (!qtyInput || isNaN(parsed)) {
      setQtyInput(String(item.quantity));
      return;
    }
    onUpdateQuantity(item.productId, parsed);
  };

  const commitPrice = () => {
    const parsed = parseFloat(priceInput);
    if (priceInput === "" || isNaN(parsed)) {
      setPriceInput(String(item.buyingPrice));
      return;
    }
    onUpdateBuyingPrice(item.productId, parsed);
  };

  return (
    <div style={styles.item}>
      <div style={styles.itemTop}>
        <span style={styles.itemName}>
          {item.productName}
          {item.productSize && (
            <span style={styles.itemSize}> · {item.productSize}</span>
          )}
        </span>
        <button
          style={styles.removeBtn}
          onClick={() => onRemove(item.productId)}
        >
          Remove
        </button>
      </div>
      <div style={styles.itemRow}>
        <div style={{ flex: 1 }}>
          <label style={styles.fieldLabel}>{t("addStockQuantityLabel")}</label>
          <FormattedNumberInput
            style={styles.fieldInput}
            value={qtyInput}
            onChange={setQtyInput}
            onBlur={commitQuantity}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.fieldLabel}>{t("buyingPriceLabel")}</label>
          <FormattedNumberInput
            style={styles.fieldInput}
            value={priceInput}
            onChange={setPriceInput}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
          />
        </div>
        <div style={{ minWidth: 90, textAlign: "right" }}>
          <label style={styles.fieldLabel}>{t("tableTotal")}</label>
          <div style={styles.itemTotal}>
            {formatTZS(item.quantity * item.buyingPrice)}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  item: { padding: "12px 0", borderBottom: "1px solid var(--border-muted)" },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemName: { fontSize: 14, fontWeight: 700 },
  itemSize: { fontWeight: 600, color: "var(--text-muted)" },
  removeBtn: { background: "none", border: "none", fontSize: 13 },
  itemRow: { display: "flex", gap: 10, alignItems: "flex-end" },
  fieldLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 4,
  },
  fieldInput: {
    width: "100%",
    padding: "8px 10px",
    border: "1.5px solid var(--border)",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--bg)",
    marginBottom: 10,
  },
  itemTotal: { fontSize: 13, fontWeight: 700, padding: "8px 0" },
};

export default RestockCartItemRow;


