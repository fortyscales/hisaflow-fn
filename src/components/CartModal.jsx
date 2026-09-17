import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext.jsx";
import { salesService } from "../services/salesService";
import { creditService } from "../services/creditService";
import { dataService } from "../services/DataService";
import CartItemRow from "./CartItemRow.jsx";
import StepIndicator from "./StepIndicator.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Always available, no setup required — matches the same generic
// cash/bank/Lipa Namba pattern already used for restocking. Specifically
// named accounts (configured in Settings) appear as additional, more
// precise options after these.
const GENERIC_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

// Three steps — pick items, review pricing and discounts, then pay —
// rather than one screen carrying quantity controls, discount inputs,
// payment method, and customer fields all at once. Each screen asks for
// one kind of decision at a time, same reasoning as the product form's
// multi-step rebuild earlier this session.
const STEPS = ["items", "review", "pay"];

const CartModal = ({ visible, onClose, onCompleted }) => {
  const {
    items,
    updateQuantity,
    updateDiscount,
    removeFromCart,
    clearCart,
    totalAmount,
    activeOrderId,
  } = useCart();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash"); // 'cash' | 'credit'
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [receivedVia, setReceivedVia] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [receiptPhone, setReceiptPhone] = useState("");
  const [receiptName, setReceiptName] = useState("");

  useEffect(() => {
    if (visible)
      dataService
        .getSettings()
        .then((s) => setPaymentAccounts(s.paymentAccounts || []));
  }, [visible]);

  if (!visible) return null;

  const resetAndClose = () => {
    setStep(0);
    setError("");
    onClose();
  };

  const goNext = () => {
    setError("");
    if (step === 0 && items.length === 0) {
      setError(t("cartEmpty"));
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleComplete = async () => {
    setError("");
    setCompleting(true);

    try {
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
              cartItems: items,
              customerName,
              customerPhone,
              orderId: activeOrderId,
            })
          : await salesService.completeCartSale(items, {
              paymentMethod,
              accountId,
              accountLabel,
              accountNumber,
              customerPhone: receiptPhone.trim() || undefined,
              customerName: receiptName.trim() || undefined,
              orderId: activeOrderId,
            });

      if (!result.success) {
        setError(result.error);
        return;
      }

      const saleData = {
        items: items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          discount: item.discount || 0,
        })),
        total: totalAmount,
        isCredit: paymentMode === "credit",
        paymentMethod,
        accountLabel,
        accountNumber,
        customerName,
        customerPhone,
        date: new Date().toISOString(),
      };

      clearCart();
      setCustomerName("");
      setCustomerPhone("");
      setReceiptPhone("");
      setReceiptName("");
      setPaymentMode("cash");
      setReceivedVia("cash");
      setStep(0);
      onCompleted(saleData);
    } catch (err) {
      console.error("Cart completion error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setCompleting(false);
    }
  };

  const stepLabel = (i) => {
    if (i === 0) return t("cartStepItems");
    if (i === 1) return t("cartStepReview");
    return t("cartStepPay");
  };
  const isLastStep = step === STEPS.length - 1;

  return (
    <div style={styles.overlay} onClick={resetAndClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("yourCartTitle")}</h2>
          <button style={styles.closeBtn} onClick={resetAndClose}>
            Close
          </button>
        </div>

        <StepIndicator steps={STEPS} currentStep={step} stepLabel={stepLabel} />

        {error && <div style={styles.error}>{error}</div>}

        {items.length === 0 && step === 0 ? (
          <div style={styles.empty}>{t("cartEmpty")}</div>
        ) : (
          <>
            {step === 0 && (
              <div style={styles.itemList}>
                {items.map((item) => (
                  <CartItemRow
                    key={item.productId}
                    item={item}
                    showDiscount={false}
                    onUpdateQuantity={updateQuantity}
                    onUpdateDiscount={updateDiscount}
                    onRemove={removeFromCart}
                  />
                ))}
              </div>
            )}

            {step === 1 && (
              <div style={styles.itemList}>
                {items.map((item) => (
                  <CartItemRow
                    key={item.productId}
                    item={item}
                    showDiscount={paymentMode === "cash"}
                    onUpdateQuantity={updateQuantity}
                    onUpdateDiscount={updateDiscount}
                    onRemove={removeFromCart}
                  />
                ))}
                <div style={styles.totalRow}>
                  <span
                    style={{ fontWeight: 700, color: "var(--text-secondary)" }}
                  >
                    {t("tableTotal")}
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 20,
                      color: "var(--primary-dark)",
                    }}
                  >
                    {formatTZS(totalAmount)}
                  </span>
                </div>
              </div>
            )}

            {step === 2 && (
              <>
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
                      ...(paymentMode === "credit"
                        ? styles.modeBtnActiveCredit
                        : {}),
                    }}
                    onClick={() => {
                      setPaymentMode("credit");
                      // Discounts only apply to cash sales for now — clear
                      // them rather than let a value sit there that looks
                      // active but silently won't be applied.
                      items.forEach((item) => {
                        if (item.discount) updateDiscount(item.productId, 0);
                      });
                    }}
                  >
                    {t("creditSaleLabel")}
                  </button>
                </div>

                {paymentMode === "cash" && (
                  <>
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
                            ...(receivedVia === acc.id
                              ? styles.accountChipActive
                              : {}),
                          }}
                          onClick={() => setReceivedVia(acc.id)}
                        >
                          {acc.label}
                          {acc.accountNumber ? ` · ${acc.accountNumber}` : ""}
                        </button>
                      ))}
                    </div>
                    {paymentAccounts.length === 0 && (
                      <div style={styles.accountHint}>
                        {t("noPaymentAccountsHint")}
                      </div>
                    )}
                  </>
                )}

                {paymentMode === "cash" && (
                  <div style={styles.customerFields}>
                    <input
                      style={styles.customerInput}
                      value={receiptName}
                      onChange={(e) => setReceiptName(e.target.value)}
                      placeholder={t("receiptNamePlaceholder")}
                    />
                    <input
                      style={styles.customerInput}
                      value={receiptPhone}
                      onChange={(e) => setReceiptPhone(e.target.value)}
                      placeholder={t("receiptPhonePlaceholder")}
                    />
                  </div>
                )}

                {paymentMode === "credit" && (
                  <div style={styles.customerFields}>
                    <input
                      style={styles.customerInput}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t("customerNamePlaceholder")}
                    />
                    <input
                      style={styles.customerInput}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={t("customerPhonePlaceholder")}
                    />
                  </div>
                )}

                <div style={styles.totalRow}>
                  <span
                    style={{ fontWeight: 700, color: "var(--text-secondary)" }}
                  >
                    {t("tableTotal")}
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 20,
                      color: "var(--primary-dark)",
                    }}
                  >
                    {formatTZS(totalAmount)}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {items.length > 0 && (
          <div style={styles.actions}>
            <button
              style={styles.backBtn}
              onClick={step === 0 ? resetAndClose : goBack}
            >
              {step === 0 ? t("cancelButton") : t("backButton")}
            </button>
            <button
              style={{
                ...styles.nextBtn,
                ...(isLastStep && paymentMode === "credit"
                  ? styles.nextBtnCredit
                  : {}),
              }}
              disabled={completing}
              onClick={isLastStep ? handleComplete : goNext}
            >
              {completing
                ? t("completing")
                : isLastStep
                  ? paymentMode === "credit"
                    ? t("completeCreditSaleButton")
                    : t("completeSaleButton")
                  : t("continueButton")}
            </button>
          </div>
        )}
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
    width: 480,
    maxHeight: "82vh",
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 800 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "var(--text-secondary)",
  },
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  empty: {
    padding: "32px 0",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
  },
  itemList: { overflow: "auto", marginBottom: 16 },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 0",
    borderTop: "1px solid var(--border-muted)",
    marginTop: 4,
    marginBottom: 14,
  },
  modeRow: { display: "flex", gap: 8, marginTop: 4, marginBottom: 12 },
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
  customerFields: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  customerInput: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  actions: { display: "flex", gap: 10, marginTop: 4 },
  backBtn: {
    flex: 1,
    minWidth: 0,
    padding: "13px 10px",
    borderRadius: 14,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: "normal",
    lineHeight: 1.25,
    textAlign: "center",
  },
  nextBtn: {
    flex: 1,
    minWidth: 0,
    padding: "13px 10px",
    borderRadius: 14,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 15,
    whiteSpace: "normal",
    lineHeight: 1.25,
    textAlign: "center",
  },
  nextBtnCredit: { background: "#8A5A1E" },
};

export default CartModal;


