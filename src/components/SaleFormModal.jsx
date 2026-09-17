import React, { useState, useMemo, useEffect } from "react";
import { salesService } from "../services/salesService";
import { creditService } from "../services/creditService";
import { dataService } from "../services/DataService";
import { useLanguage } from "../context/LanguageContext.jsx";
import FormattedNumberInput from "./FormattedNumberInput.jsx";
import ProductPicker from "./ProductPicker.jsx";
import ProductIdentity from "./ProductIdentity.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Handles completion internally now (cash or credit), same pattern as
// CartModal — a single-product sale should be able to go on credit just
// as easily as a cart of several, not a capability only the cart gets.
// Always available, no setup required — matches the same generic
// cash/bank/Lipa Namba pattern already used for restocking. Specifically
// named accounts (configured in Settings) appear as additional, more
// precise options after these, for shops that want to track exactly
// which bank account received the money.
const GENERIC_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

const SaleFormModal = ({
  visible,
  products,
  preSelectedProductId,
  onCompleted,
  onClose,
}) => {
  const { t } = useLanguage();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [receivedVia, setReceivedVia] = useState("cash"); // 'cash' or an account id
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [receiptPhone, setReceiptPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (visible)
      dataService
        .getSettings()
        .then((s) => setPaymentAccounts(s.paymentAccounts || []));
  }, [visible]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [productId, products],
  );

  const handleSelectProduct = (id) => {
    setProductId(id);
    const p = products.find((prod) => prod.id === id);
    setSellingPrice(p ? String(p.sellingPrice) : "");
    setError("");
  };

  useEffect(() => {
    if (visible && preSelectedProductId) {
      handleSelectProduct(preSelectedProductId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, preSelectedProductId]);

  if (!visible) return null;

  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(sellingPrice) || 0;
  const discountNum = parseFloat(discount) || 0;
  const total = qtyNum * priceNum;

  const handleSubmit = async () => {
    if (!selectedProduct) {
      setError(t("chooseProductError"));
      return;
    }
    if (qtyNum <= 0) {
      setError(t("enterValidQuantityError"));
      return;
    }
    if (qtyNum > (selectedProduct.stock || 0)) {
      setError(
        t("notEnoughStockError", {
          stock: selectedProduct.stock,
          unit: selectedProduct.unit,
        }),
      );
      return;
    }
    if (paymentMode === "cash" && discountNum < 0) {
      setError(t("negativeDiscountError"));
      return;
    }
    if (
      paymentMode === "cash" &&
      discountNum > 0 &&
      discountNum >= priceNum * qtyNum
    ) {
      setError(t("discountExceedsTotalError"));
      return;
    }

    setCompleting(true);
    try {
      const cartItem = {
        productId,
        productName: selectedProduct.name,
        unit: selectedProduct.unit,
        quantity: qtyNum,
        sellingPrice: priceNum,
      };
      const selectedAccount = paymentAccounts.find((a) => a.id === receivedVia);
      const paymentMethod =
        paymentMode === "cash"
          ? selectedAccount
            ? selectedAccount.type
            : receivedVia
          : "";
      const accountId =
        paymentMode === "cash" ? selectedAccount?.id || null : null;
      const accountLabel =
        paymentMode === "cash" ? selectedAccount?.label || "" : "";
      const accountNumber =
        paymentMode === "cash" ? selectedAccount?.accountNumber || "" : "";

      const result =
        paymentMode === "credit"
          ? await creditService.completeCreditSale({
              cartItems: [cartItem],
              customerName,
              customerPhone,
            })
          : await salesService.completeSale({
              productId,
              quantity: qtyNum,
              sellingPrice: priceNum,
              paymentMethod,
              accountId,
              accountLabel,
              accountNumber,
              customerPhone: receiptPhone.trim() || undefined,
              customerName: receiptName.trim() || undefined,
              discount: discountNum || undefined,
            });

      if (!result.success) {
        setError(result.error || t("saleFailedError"));
        return;
      }

      const saleData = {
        items: [
          {
            productName: selectedProduct.name,
            quantity: qtyNum,
            sellingPrice: priceNum,
            discount: paymentMode === "cash" ? discountNum : 0,
          },
        ],
        total: total - (paymentMode === "cash" ? discountNum : 0),
        discount: paymentMode === "cash" ? discountNum : 0,
        isCredit: paymentMode === "credit",
        paymentMethod,
        accountLabel,
        accountNumber,
        customerName,
        customerPhone,
        date: new Date().toISOString(),
      };

      handleClose();
      onCompleted(saleData);
    } catch (err) {
      console.error("Sale completion error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setCompleting(false);
    }
  };

  const handleClose = () => {
    setProductId("");
    setQuantity("1");
    setSellingPrice("");
    setPaymentMode("cash");
    setReceivedVia("cash");
    setCustomerName("");
    setCustomerPhone("");
    setReceiptPhone("");
    setDiscount("");
    setReceiptName("");
    setError("");
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t("sellProductTitle")}</h2>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>{t("tableProduct")}</label>
        <ProductPicker
          products={products.filter((p) => (p.stock || 0) > 0)}
          value={productId}
          onChange={handleSelectProduct}
          placeholder={t("chooseProductPlaceholder")}
          noResultsMessage={t("noMatchingProductsMessage")}
          refineHint={t("keepTypingToNarrowHint")}
        />

        {selectedProduct && (
          <div style={styles.productSummary}>
            <ProductIdentity product={selectedProduct} showStock />
            <div style={styles.productFacts}>
              <div><span>Brand:</span>{" "}<strong>{selectedProduct.brand || "—"}</strong></div>
              <div><span>Size:</span>{" "}<strong>{selectedProduct.size || "—"}</strong></div>
              <div><span>Unit:</span>{" "}<strong>{selectedProduct.unit || "—"}</strong></div>
              <div><span>Category:</span>{" "}<strong>{selectedProduct.category || "—"}</strong></div>
              <div><span>Buy:</span>{" "}<strong>{formatTZS(selectedProduct.buyingPrice)}</strong></div>
              <div><span>Sell:</span>{" "}<strong>{formatTZS(selectedProduct.sellingPrice)}</strong></div>
              {selectedProduct.expiryDate && <div><span>Expiry:</span>{" "}<strong>{new Date(selectedProduct.expiryDate).toLocaleDateString("en-GB")}</strong></div>}
            </div>
          </div>
        )}

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("tableQuantity")}</label>
            <div style={styles.qtyControl}>
              <button type="button" style={styles.qtyBtn} onClick={() => setQuantity(String(Math.max(1, qtyNum - 1)))}>−</button>
              <FormattedNumberInput style={{...styles.input, ...styles.qtyInput}} value={quantity} onChange={setQuantity} />
              <button type="button" style={styles.qtyBtn} onClick={() => setQuantity(String(Math.min(selectedProduct?.stock || qtyNum + 1, qtyNum + 1)))}>+</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>{t("sellingPriceLabel")}</label>
            <FormattedNumberInput
              style={styles.input}
              value={sellingPrice}
              onChange={setSellingPrice}
            />
          </div>
        </div>

        {paymentMode === "cash" && (
          <>
            <label style={styles.label}>{t("discountOptionalLabel")}</label>
            <FormattedNumberInput
              style={styles.input}
              value={discount}
              onChange={setDiscount}
              placeholder="0"
            />
          </>
        )}

        <div style={styles.modeRow}>
          <button
            style={{
              ...styles.modeBtn,
              ...(paymentMode === "cash" ? styles.modeBtnActive : {}),
            }}
            onClick={() => setPaymentMode("cash")}
          >
            {t("cashSaleLabel")}
          </button>
          <button
            style={{
              ...styles.modeBtn,
              ...(paymentMode === "credit" ? styles.modeBtnActiveCredit : {}),
            }}
            onClick={() => setPaymentMode("credit")}
          >
            {t("creditSaleLabel")}
          </button>
        </div>

        {paymentMode === "cash" && (
          <>
            <label style={styles.label}>{t("receivedViaLabel")}</label>
            <div style={styles.accountChipRow}>
              {GENERIC_METHODS.map((m) => (
                <button
                  key={m.value}
                  style={{
                    ...styles.accountChip,
                    ...(receivedVia === m.value
                      ? styles.accountChipActive
                      : {}),
                  }}
                  onClick={() => setReceivedVia(m.value)}
                >
                  {t(m.labelKey)}
                </button>
              ))}
              {paymentAccounts.map((acc) => (
                <button
                  key={acc.id}
                  style={{
                    ...styles.accountChip,
                    ...(receivedVia === acc.id ? styles.accountChipActive : {}),
                  }}
                  onClick={() => setReceivedVia(acc.id)}
                >
                  {acc.label}
                  {acc.accountNumber ? ` · ${acc.accountNumber}` : ""}
                </button>
              ))}
            </div>
            {paymentAccounts.length === 0 && (
              <div style={styles.accountHint}>{t("noPaymentAccountsHint")}</div>
            )}
          </>
        )}

        {paymentMode === "cash" && (
          <div style={styles.customerFields}>
            <input
              style={styles.input}
              value={receiptName}
              onChange={(e) => setReceiptName(e.target.value)}
              placeholder={t("receiptNamePlaceholder")}
            />
            <input
              style={styles.input}
              value={receiptPhone}
              onChange={(e) => setReceiptPhone(e.target.value)}
              placeholder={t("receiptPhonePlaceholder")}
            />
          </div>
        )}

        {paymentMode === "credit" && (
          <div style={styles.customerFields}>
            <input
              style={styles.input}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t("customerNamePlaceholder")}
            />
            <input
              style={styles.input}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t("customerPhonePlaceholder")}
            />
          </div>
        )}

        {selectedProduct && (
          <div style={styles.totalBox}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              {t("tableTotal")}
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--primary-dark)",
              }}
            >
              {formatTZS(total - (paymentMode === "cash" ? discountNum : 0))}
            </span>
          </div>
        )}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={handleClose}>
            {t("cancelButton")}
          </button>
          <button
            style={{
              ...styles.saveBtn,
              ...(paymentMode === "credit" ? styles.saveBtnCredit : {}),
            }}
            disabled={completing}
            onClick={handleSubmit}
          >
            {completing
              ? t("completing")
              : paymentMode === "credit"
                ? t("completeCreditSaleButton")
                : t("completeSaleButton")}
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
    width: 560,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 28,
    maxHeight: "90vh",
    overflow: "auto",
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 18 },
  productSummary: { marginTop: 10, marginBottom: 14, padding: 14, border: "1px solid var(--border-muted)", borderRadius: 14, background: "var(--bg)" },
  productFacts: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 },
  qtyControl: { display: "flex", alignItems: "center", gap: 6 },
  qtyBtn: { width: 38, height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 20, fontWeight: 800, cursor: "pointer" },
  qtyInput: { textAlign: "center", minWidth: 0 },
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
  row: { display: "flex", gap: 12 },
  modeRow: { display: "flex", gap: 8, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
  modeBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  modeBtnActiveCredit: {
    background: "var(--accent-light)",
    borderColor: "var(--accent)",
    color: "#8A5A1E",
  },
  accountChipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  accountHint: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: -8,
    marginBottom: 14,
  },
  accountChip: {
    padding: "8px 14px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  accountChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  customerFields: { display: "flex", flexDirection: "column", gap: 0 },
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--primary-light)",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 18,
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
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  saveBtnCredit: { background: "#8A5A1E" },
};

export default SaleFormModal;


