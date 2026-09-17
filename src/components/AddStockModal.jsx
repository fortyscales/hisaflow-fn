import React, { useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { supplierService } from "../services/supplierservice";
import FormattedNumberInput from "./FormattedNumberInput.jsx";
import SupplierPaymentSection from "./SupplierPaymentSection.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const AddStockModal = ({ visible, product, onSave, onClose }) => {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [accountId, setAccountId] = useState(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) dataService.getSuppliers().then(setSuppliers);
  }, [visible]);

  useEffect(() => {
    if (visible && product) {
      setQuantity("");
      setBuyingPrice(String(Math.round(product.buyingPrice || 0)));
      setSupplierId(null);
      setPaymentStatus("paid");
      setPaymentMethod("cash");
      setAccountId(null);
      setAccountLabel("");
      setAccountNumber("");
      setError("");
      setSaving(false);
    }
  }, [visible, product]);

  if (!visible || !product) return null;

  const handleSave = async () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(buyingPrice) || 0;
    if (qty <= 0) {
      setError(t("enterValidQuantityError"));
      return;
    }
    setSaving(true);
    try {
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);
      const result = await onSave({
        productId: product.id,
        quantity: qty,
        buyingPrice: price,
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name || "",
        paymentMethod: paymentStatus === "paid" ? paymentMethod : "",
        accountId: paymentStatus === "paid" ? accountId : null,
        accountLabel: paymentStatus === "paid" ? accountLabel : "",
        accountNumber: paymentStatus === "paid" ? accountNumber : "",
      });
      if (result && result.success === false) {
        setError(result.error);
        return;
      }
      if (supplierId && paymentStatus === "credit") {
        await supplierService.recordSupply(supplierId, qty * price);
      }
    } catch (err) {
      console.error("Add stock error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("addStockTitle")}</h2>
        <div style={styles.productName}>{product.name}</div>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("addStockQuantityLabel")}</label>
        <FormattedNumberInput
          style={styles.input}
          value={quantity}
          onChange={setQuantity}
          placeholder="0"
          autoFocus
        />

        <label style={styles.label}>{t("buyingPriceLabel")}</label>
        <FormattedNumberInput
          style={styles.input}
          value={buyingPrice}
          onChange={setBuyingPrice}
          placeholder="0"
        />

        <div style={styles.hint}>{t("addStockPriceHint")}</div>

        <SupplierPaymentSection
          suppliers={suppliers}
          onSuppliersChange={setSuppliers}
          supplierId={supplierId}
          onSupplierChange={setSupplierId}
          paymentStatus={paymentStatus}
          onPaymentStatusChange={setPaymentStatus}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          accountId={accountId}
          onAccountChange={(id, label, number) => {
            setAccountId(id);
            setAccountLabel(label);
            setAccountNumber(number || "");
          }}
        />

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.saveBtn} disabled={saving} onClick={handleSave}>
            {saving ? t("completing") : t("addStockButton")}
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
    width: 400,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 4 },
  productName: { fontSize: 13, color: "var(--text-muted)", marginBottom: 18 },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
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
  hint: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginBottom: 18,
    marginTop: -8,
  },
  actions: { display: "flex", gap: 10 },
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
  saveBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default AddStockModal;


