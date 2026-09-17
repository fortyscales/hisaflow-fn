import React, { useState } from "react";
import FormattedNumberInput from "./FormattedNumberInput.jsx";
import ProductPicker from "./ProductPicker.jsx";
import ProductIdentity from "./ProductIdentity.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// Writes up an order ticket for a customer before they reach the
// cashier. issuedBy is a plain free-text field — whoever is physically
// writing up the order types their own name, so the owner's wife or
// sibling can issue an order without needing their own staff login.
const CreateOrderModal = ({ visible, products, onCreate, onClose }) => {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [issuedBy, setIssuedBy] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const handleAddItem = () => {
    setError("");
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setError(t("selectProductError"));
      return;
    }
    const qty = parseInt(quantity, 10) || 0;
    if (qty <= 0) {
      setError(t("enterValidQuantityError"));
      return;
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: qty,
          expectedPrice: product.sellingPrice,
          productBrand: product.brand || "",
          productSize: product.size || "",
          productUnit: product.unit || "",
          productCategory: product.category || "",
        },
      ];
    });
    setProductId("");
    setQuantity("1");
  };

  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((i) => i.productId !== id));
  };

  const handleClose = () => {
    setItems([]);
    setProductId("");
    setQuantity("1");
    setIssuedBy("");
    setCustomerName("");
    setCustomerPhone("");
    setError("");
    onClose();
  };

  const handleCreate = async () => {
    if (saving) return;
    if (items.length === 0) {
      setError(t("addAtLeastOneItemError"));
      return;
    }
    if (!issuedBy.trim()) {
      setError(t("issuedByRequiredError"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await onCreate({
        issuedBy: issuedBy.trim(),
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        items,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const estimatedTotal = items.reduce(
    (sum, i) => sum + i.quantity * (i.expectedPrice || 0),
    0,
  );

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("newOrderTitle")}</h2>
        <p style={styles.subtitle}>{t("newOrderSubtitle")}</p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <ProductPicker
              products={products}
              value={productId}
              onChange={setProductId}
              placeholder={t("selectProductPlaceholder")}
              noResultsMessage={t("noMatchingProductsMessage")}
              refineHint={t("keepTypingToNarrowHint")}
              renderOption={(p) => <ProductIdentity product={p} compact showStock />}
            />
          </div>
          <FormattedNumberInput
            style={styles.qtyInput}
            value={quantity}
            onChange={setQuantity}
          />
          <button style={styles.addBtn} onClick={handleAddItem}>
            {t("addItemButton")}
          </button>
        </div>

        {items.length > 0 && (
          <div style={styles.itemsList}>
            {items.map((item) => (
              <div key={item.productId} style={styles.itemRow}>
                <span style={styles.itemName}><strong>{item.productName}</strong>{[item.productBrand,item.productSize,item.productUnit].filter(Boolean).length ? <small style={styles.itemMeta}>{[item.productBrand,item.productSize,item.productUnit].filter(Boolean).join(" · ")}</small> : null}</span>
                <span style={styles.itemQty}>× {item.quantity}</span>
                <button
                  style={styles.removeBtn}
                  onClick={() => handleRemoveItem(item.productId)}
                >
                  ×
                </button>
              </div>
            ))}
            <div style={styles.totalRow}>
              <span>{t("estimatedTotalLabel")}</span>
              <span style={styles.totalAmount}>
                TZS {Math.round(estimatedTotal).toLocaleString("en-US")}
              </span>
            </div>
          </div>
        )}

        <label style={styles.label}>{t("issuedByLabel")}</label>
        <input
          style={styles.input}
          value={issuedBy}
          onChange={(e) => setIssuedBy(e.target.value)}
          placeholder={t("issuedByPlaceholder")}
        />

        <label style={styles.label}>{t("customerNameOptionalLabel")}</label>
        <input
          style={styles.input}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={t("customerNamePlaceholder")}
        />

        <label style={styles.label}>{t("customerPhoneOptionalLabel")}</label>
        <input
          style={styles.input}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder={t("customerPhonePlaceholder")}
        />

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={handleClose}>
            {t("cancelButton")}
          </button>
          <button
            style={styles.createBtn}
            disabled={saving}
            onClick={handleCreate}
          >
            {saving ? t("completing") : t("createOrderButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: 460,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    maxHeight: "85vh",
    overflow: "auto",
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 4 },
  subtitle: { fontSize: 12, color: "var(--text-muted)", marginBottom: 18 },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  row: { display: "flex", gap: 8, marginBottom: 14 },
  select: {
    flex: 1,
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  qtyInput: {
    width: 64,
    padding: "11px 8px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center",
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  addBtn: {
    padding: "0 16px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },
  itemsList: {
    background: "var(--bg)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  itemRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
  itemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  itemMeta: { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginTop: 2 },
  itemQty: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "none",
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontWeight: 700,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTop: "1px solid var(--border-muted)",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  totalAmount: { color: "var(--primary-dark)" },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "var(--text-primary)",
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  actions: { display: "flex", gap: 10, marginTop: 6 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  createBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default CreateOrderModal;


