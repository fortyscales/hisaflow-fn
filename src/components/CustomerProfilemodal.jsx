import React, { useState } from "react";
import { whatsappService } from "../services/whatsappService";
import RecordPaymentModal from "./RecordPaymentModal.jsx";
import PaymentReceiptModal from "./PaymentReceiptModal.jsx";
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
    year: "numeric",
  });
};

const statusColor = (status) => {
  if (status === "paid") return "var(--success)";
  if (status === "partial") return "var(--warning)";
  return "var(--danger)";
};

const itemSummary = (cs) =>
  (cs.items || []).map((item) => item.productName).join(", ");

const CustomerProfileModal = ({
  visible,
  customer,
  businessName,
  paymentAccounts = [],
  onRecordPayment,
  onClose,
}) => {
  const { t } = useLanguage();
  const [payingCreditSale, setPayingCreditSale] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [reminderError, setReminderError] = useState("");

  if (!visible || !customer) return null;

  const statusLabel = (status) => {
    if (status === "paid") return t("statusPaid");
    if (status === "partial") return t("statusPartial");
    return t("statusPending");
  };

  const handleSendReminder = async () => {
    if (!customer.phone) return;
    setReminderError("");
    const message = t("customerProfileGreeting", { name: customer.name });
    try {
      const result = await whatsappService.sendMessage(customer.phone, message);
      if (!result.success) {
        setReminderError(result.error || t("unexpectedErrorTryAgain"));
      }
    } catch (err) {
      console.error("Send reminder error:", err);
      setReminderError(t("unexpectedErrorTryAgain"));
    }
  };

  const handleSavePayment = async (creditSaleId, amount, paymentMethod, account) => {
    const target = payingCreditSale;
    const result = await onRecordPayment(creditSaleId, amount, paymentMethod, account);
    if (result.success) {
      setPayingCreditSale(null);
      const amountPaidAfter = target.amountPaid + amount;
      setPaymentReceipt({
        customerName: target.customerName,
        customerPhone: target.customerPhone,
        items: target.items,
        paymentAmount: amount,
        paymentMethod,
        accountLabel: account?.label || "",
        accountNumber: account?.accountNumber || "",
        totalAmount: target.totalAmount,
        amountPaidAfter,
        remainingAmount: target.totalAmount - amountPaidAfter,
        date: new Date().toISOString(),
      });
    }
    return result;
  };

  const sortedTransactions = customer.creditSales
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.avatar}>
            {(customer.name || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={styles.name}>{customer.name}</h2>
            {customer.phone && <div style={styles.phone}>{customer.phone}</div>}
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>{t("totalSpentLabel")}</div>
            <div style={styles.statValue}>{formatTZS(customer.totalSpent)}</div>
          </div>
          <div
            style={{
              ...styles.statBox,
              background:
                customer.totalDebt > 0
                  ? "var(--danger-light)"
                  : "var(--success-light)",
            }}
          >
            <div style={styles.statLabel}>{t("remainingDebtLabel")}</div>
            <div
              style={{
                ...styles.statValue,
                color:
                  customer.totalDebt > 0 ? "var(--danger)" : "var(--success)",
              }}
            >
              {formatTZS(customer.totalDebt)}
            </div>
          </div>
        </div>

        {customer.phone && (
          <>
            {reminderError && (
              <div style={styles.reminderError}>{reminderError}</div>
            )}
            <button style={styles.remindBtn} onClick={handleSendReminder}>
              {t("sendReminderButton")}
            </button>
          </>
        )}

        <h3 style={styles.sectionTitle}>{t("transactionHistoryLabel")}</h3>
        <div style={styles.list}>
          {sortedTransactions.map((cs) => {
            const remaining = cs.totalAmount - cs.amountPaid;
            return (
              <div key={cs.id} style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.itemsLine}>{itemSummary(cs)}</div>
                  <div style={styles.dateLine}>{formatDate(cs.date)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={styles.amountLine}>
                    {formatTZS(cs.totalAmount)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: statusColor(cs.status),
                    }}
                  >
                    {statusLabel(cs.status)}
                  </div>
                </div>
                {cs.status !== "paid" && (
                  <button
                    style={styles.payBtn}
                    onClick={() => setPayingCreditSale(cs)}
                  >
                    {t("recordPaymentButton")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <RecordPaymentModal
        visible={!!payingCreditSale}
        creditSale={payingCreditSale}
        paymentAccounts={paymentAccounts}
        onSave={handleSavePayment}
        onClose={() => setPayingCreditSale(null)}
      />

      <PaymentReceiptModal
        visible={!!paymentReceipt}
        payment={paymentReceipt}
        businessName={businessName}
        onClose={() => setPaymentReceipt(null)}
      />
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 55,
  },
  modal: {
    width: 460,
    maxHeight: "85vh",
    overflow: "auto",
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
  },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: "var(--primary)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
    flexShrink: 0,
  },
  name: { fontSize: 17, fontWeight: 800 },
  phone: { fontSize: 12, color: "var(--text-muted)", marginTop: 1 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "var(--text-secondary)",
  },
  statsRow: { display: "flex", gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1,
    background: "var(--bg)",
    borderRadius: 14,
    padding: "12px 14px",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 4,
  },
  statValue: { fontSize: 16, fontWeight: 800 },
  reminderError: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 10,
  },
  remindBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 13, fontWeight: 800, marginBottom: 10 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border-muted)",
  },
  itemsLine: {
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dateLine: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
  amountLine: { fontSize: 13, fontWeight: 700 },
  payBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 11,
    flexShrink: 0,
  },
};

export default CustomerProfileModal;


