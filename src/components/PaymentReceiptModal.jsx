import React from "react";
import { getCurrentActor } from "../services/ActivityLogService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const formatDateTime = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return (
    d.toLocaleDateString("sw-TZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })
  );
};

const paymentMethodLabel = (method, t) => {
  if (method === "cash") return t("cashMethodOption");
  if (method === "bank_transfer") return t("bankTransferMethodOption");
  if (method === "lipa_namba") return t("lipaNambaMethodOption");
  return "";
};

// A separate receipt type from the sale receipt — this one confirms a
// payment against an existing credit balance, not a new purchase. Shows
// what was paid today alongside the full debt picture (total, paid to
// date, what's left), so the customer walks away with a clear record of
// where their account actually stands, not just today's payment amount.
const PaymentReceiptModal = ({ visible, payment, businessName, onClose }) => {
  const { t } = useLanguage();

  if (!visible || !payment) return null;

  const isSettled = payment.remainingAmount <= 0;
  const servedBy = getCurrentActor();
  const handlePrint = () => window.print();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalWrap} onClick={(e) => e.stopPropagation()}>
        <div id="receipt-print-area" style={styles.receipt}>
          <div style={styles.center}>
            <div style={styles.businessName}>{businessName || "HisaFlow"}</div>
            <div style={styles.receiptLabel}>{t("paymentReceiptLabel")}</div>
            <div style={styles.dateText}>{formatDateTime(payment.date)}</div>
          </div>

          <div style={styles.divider} />

          <div style={styles.customerInfo}>
            <div>
              <strong>{t("customerLabel")}</strong> {payment.customerName}
            </div>
            {payment.customerPhone && (
              <div>
                <strong>{t("phoneLabel")}</strong> {payment.customerPhone}
              </div>
            )}
            {(payment.items || []).map((item, idx) => (
              <div key={idx}>
                {item.productName} ({item.quantity} {item.unit || "pc"})
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.grandTotalRow}>
            <span>{t("paymentReceivedLabel")}</span>
            <span>{formatTZS(payment.paymentAmount)}</span>
          </div>
          {payment.paymentMethod && (
            <div style={styles.methodLine}>
              {paymentMethodLabel(payment.paymentMethod, t)}
              {payment.accountLabel ? ` — ${payment.accountLabel}${payment.accountNumber ? ` · ${payment.accountNumber}` : ""}` : ""}
            </div>
          )}
          <div style={styles.totalsRow}>
            <span>{t("totalDebtLabel")}</span>
            <span>{formatTZS(payment.totalAmount)}</span>
          </div>
          <div style={styles.totalsRow}>
            <span>{t("totalPaidSoFarLabel")}</span>
            <span>{formatTZS(payment.amountPaidAfter)}</span>
          </div>
          <div
            style={{
              ...styles.totalsRow,
              ...(isSettled ? styles.settled : styles.remaining),
            }}
          >
            <span>
              {isSettled ? t("debtSettledLabel") : t("remainingLabel")}
            </span>
            <span>{formatTZS(Math.max(payment.remainingAmount, 0))}</span>
          </div>

          {servedBy && (
            <div style={styles.servedByLine}>
              {t("servedByLabel")} {servedBy}
            </div>
          )}

          <div style={styles.divider} />
          <div style={styles.footer}>
            {t("defaultFooterPayment")} · {businessName || "HisaFlow"}
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.printBtn} onClick={handlePrint}>
            {t("printReceiptButton")}
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
    zIndex: 60,
  },
  modalWrap: { width: 340 },
  receipt: {
    background: "white",
    borderRadius: 12,
    padding: 24,
    fontFamily: "monospace",
    color: "#292524",
    marginBottom: 16,
  },
  center: { textAlign: "center", marginBottom: 10 },
  businessName: { fontSize: 16, fontWeight: 800 },
  receiptLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#43614F",
    marginTop: 4,
  },
  dateText: { fontSize: 11, color: "#78716C", marginTop: 2 },
  divider: { borderTop: "1px dashed #A8A29E", margin: "10px 0" },
  customerInfo: { fontSize: 12, color: "#292524", lineHeight: 1.6 },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 15,
    fontWeight: 800,
    color: "#43614F",
    marginBottom: 6,
  },
  methodLine: {
    fontSize: 11,
    color: "#78716C",
    marginBottom: 10,
    marginTop: -4,
  },
  totalsRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    marginBottom: 4,
  },
  remaining: { color: "#B4645C", fontWeight: 700 },
  settled: { color: "#5B8A6E", fontWeight: 700 },
  servedByLine: { fontSize: 10, color: "#78716C", marginTop: 8 },
  footer: { textAlign: "center", fontSize: 11, color: "#78716C", marginTop: 4 },
  actions: { display: "flex", gap: 10 },
  closeBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  printBtn: {
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

export default PaymentReceiptModal;


