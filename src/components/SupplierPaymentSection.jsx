import React, { useState, useEffect } from "react";
import SupplierPicker from "./SupplierPicker.jsx";
import { dataService } from "../services/DataService";
import { useLanguage } from "../context/LanguageContext.jsx";

// Cash, bank transfer, or Lipa Namba — the three ways shop owners
// actually pay suppliers, per direct customer feedback. Specifically
// named accounts (configured in Settings) appear as additional, more
// precise chips right alongside these, for shops that want to record
// exactly which bank account the money left from — same pattern as
// "Received Via" on a sale.
const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
];

// The one shared home for "who supplied this stock, and how was it paid
// for" — built specifically because the same bug (payment method
// silently hidden until a supplier was picked) was found and fixed three
// separate times in three separate components this session. Recording
// how stock was paid for never requires a supplier first — "owe
// supplier" needs someone to owe, but "I paid cash for this" is true
// whether or not a formal supplier record exists for a one-off
// purchase. That's the one rule this component exists to enforce in
// exactly one place, so it can't quietly regress a fourth time.
//
// accountId/onAccountChange are optional and controlled the same way as
// paymentMethod — when a specific account chip is picked, this fires
// both onPaymentMethodChange (with that account's type, for
// filtering/reporting) and onAccountChange (with its id and label), so
// the caller ends up with the same {paymentMethod, accountId,
// accountLabel} shape completeSale already produces for a cash sale.
const SupplierPaymentSection = ({
  suppliers,
  onSuppliersChange,
  supplierId,
  onSupplierChange,
  paymentStatus,
  onPaymentStatusChange,
  paymentMethod,
  onPaymentMethodChange,
  accountId,
  onAccountChange,
}) => {
  const { t } = useLanguage();
  const [paymentAccounts, setPaymentAccounts] = useState([]);

  useEffect(() => {
    dataService
      .getSettings()
      .then((s) => setPaymentAccounts(s.paymentAccounts || []));
  }, []);

  const handleSelectGenericMethod = (value) => {
    onPaymentMethodChange(value);
    onAccountChange?.(null, "", "");
  };

  const handleSelectAccount = (account) => {
    onPaymentMethodChange(account.type);
    onAccountChange?.(account.id, account.label, account.accountNumber || "");
  };

  return (
    <>
      <label style={styles.label}>{t("supplierOptionalLabel")}</label>
      <SupplierPicker
        suppliers={suppliers}
        selectedSupplierId={supplierId || null}
        onSelect={(id) => onSupplierChange(id || "")}
        onSupplierAdded={(newSupplier) => {
          onSuppliersChange([...suppliers, newSupplier]);
          onSupplierChange(newSupplier.id);
        }}
      />

      {supplierId && (
        <div style={styles.paymentToggleRow}>
          <button
            style={{
              ...styles.paymentToggle,
              ...(paymentStatus === "paid" ? styles.paymentToggleActive : {}),
            }}
            onClick={() => onPaymentStatusChange("paid")}
          >
            {t("paidNowOption")}
          </button>
          <button
            style={{
              ...styles.paymentToggle,
              ...(paymentStatus === "credit"
                ? styles.paymentToggleActiveCredit
                : {}),
            }}
            onClick={() => onPaymentStatusChange("credit")}
          >
            {t("oweSupplierOption")}
          </button>
        </div>
      )}

      {(!supplierId || paymentStatus === "paid") && (
        <>
          <label style={styles.label}>{t("paidViaLabel")}</label>
          <div style={styles.methodRow}>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                style={{
                  ...styles.methodChip,
                  ...(paymentMethod === m.value && !accountId
                    ? styles.methodChipActive
                    : {}),
                }}
                onClick={() => handleSelectGenericMethod(m.value)}
              >
                {t(m.labelKey)}
              </button>
            ))}
            {paymentAccounts.map((acc) => (
              <button
                key={acc.id}
                style={{
                  ...styles.methodChip,
                  ...(accountId === acc.id ? styles.methodChipActive : {}),
                }}
                onClick={() => handleSelectAccount(acc)}
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
    </>
  );
};

const styles = {
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--text-primary)",
  },
  paymentToggleRow: { display: "flex", gap: 8, marginBottom: 14, marginTop: 8 },
  paymentToggle: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  paymentToggleActive: {
    background: "var(--success-light)",
    borderColor: "var(--success)",
    color: "var(--success)",
  },
  paymentToggleActiveCredit: {
    background: "var(--danger-light)",
    borderColor: "var(--danger)",
    color: "var(--danger)",
  },
  methodRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
    marginTop: 8,
  },
  accountHint: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: -8,
    marginBottom: 14,
  },
  methodChip: {
    padding: "8px 12px",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 11,
  },
  methodChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
};

export { PAYMENT_METHODS };
export default SupplierPaymentSection;


