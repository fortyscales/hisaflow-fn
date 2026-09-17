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

const paymentMethodDisplay = (method, accountLabel, accountNumber, t) => {
  if (method === "cash") return t("cashMethodOption");
  const methodLabel =
    method === "bank_transfer"
      ? t("bankTransferMethodOption")
      : t("lipaNambaMethodOption");
  if (!accountLabel) return methodLabel;
  const accountPart = accountNumber
    ? `${accountLabel} · ${accountNumber}`
    : accountLabel;
  return `${methodLabel} — ${accountPart}`;
};

// sale = { items: [{productName, quantity, sellingPrice}], total, customerName?, customerPhone?, isCredit?, date }
const ReceiptModal = ({ visible, sale, settings, onClose }) => {
  const { t } = useLanguage();

  if (!visible || !sale) return null;

  const handlePrint = () => window.print();

  const businessName = settings?.businessName || "HisaFlow";
  const vatEnabled = !!settings?.vatEnabled;
  const vatRate = settings?.vatRate || 18;
  const servedBy = getCurrentActor();

  const totalExclVat = vatEnabled
    ? sale.total / (1 + vatRate / 100)
    : sale.total;
  const vatAmount = vatEnabled ? sale.total - totalExclVat : 0;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalWrap} onClick={(e) => e.stopPropagation()}>
        <div id="receipt-print-area" style={styles.receipt}>
          <div style={styles.center}>
            <div style={styles.businessName}>{businessName}</div>
            <div style={styles.dateText}>{formatDateTime(sale.date)}</div>
            {(settings?.tin || settings?.vrn) && (
              <div style={styles.taxInfo}>
                {settings.tin ? `TIN: ${settings.tin}` : ""}
                {settings.tin && settings.vrn ? " · " : ""}
                {settings.vrn ? `VRN: ${settings.vrn}` : ""}
              </div>
            )}
          </div>

          <div style={styles.divider} />

          {sale.items.map((item, idx) => (
            <div key={idx} style={styles.itemRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.itemName}>{item.productName}</div>
                <div style={styles.itemSub}>
                  {item.quantity} × {formatTZS(item.sellingPrice)}
                </div>
                {item.discount > 0 && (
                  <div style={styles.itemDiscountSub}>
                    {t("discountLabel")}: −{formatTZS(item.discount)}
                  </div>
                )}
              </div>
              <div style={styles.itemTotal}>
                {formatTZS(
                  item.quantity * item.sellingPrice - (item.discount || 0),
                )}
              </div>
            </div>
          ))}

          <div style={styles.divider} />

          {vatEnabled ? (
            <>
              <div style={styles.totalRow}>
                <span style={styles.subTotalLabel}>
                  {t("totalExclVatLabel")}
                </span>
                <span style={styles.subTotalValue}>
                  {formatTZS(totalExclVat)}
                </span>
              </div>
              <div style={styles.totalRow}>
                <span style={styles.subTotalLabel}>
                  {t("vatLabel", { rate: vatRate })}
                </span>
                <span style={styles.subTotalValue}>{formatTZS(vatAmount)}</span>
              </div>
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>{t("totalInclVatLabel")}</span>
                <span style={styles.totalValue}>{formatTZS(sale.total)}</span>
              </div>
            </>
          ) : (
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>{t("tableTotal")}</span>
              <span style={styles.totalValue}>{formatTZS(sale.total)}</span>
            </div>
          )}

          {!sale.isCredit && sale.paymentMethod && (
            <div style={styles.methodLine}>
              {paymentMethodDisplay(
                sale.paymentMethod,
                sale.accountLabel,
                sale.accountNumber,
                t,
              )}
            </div>
          )}

          {sale.isCredit && (
            <>
              <div style={styles.divider} />
              <div style={styles.creditNote}>{t("creditSaleLabel")}</div>
              <div style={styles.itemSub}>
                {sale.customerName}
                {sale.customerPhone ? ` · ${sale.customerPhone}` : ""}
              </div>
            </>
          )}

          {servedBy && (
            <div style={styles.servedByLine}>
              {t("servedByLabel")} {servedBy}
            </div>
          )}

          <div style={styles.divider} />
          <div style={styles.thankYou}>{t("receiptThankYou")}</div>
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
  dateText: { fontSize: 11, color: "#78716C", marginTop: 2 },
  taxInfo: { fontSize: 9, color: "#78716C", marginTop: 4 },
  divider: { borderTop: "1px dashed #A8A29E", margin: "10px 0" },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemName: { fontSize: 13, fontWeight: 700 },
  itemSub: { fontSize: 11, color: "#78716C", marginTop: 1 },
  itemDiscountSub: {
    fontSize: 11,
    fontWeight: 700,
    color: "#B4645C",
    marginTop: 1,
  },
  itemTotal: { fontSize: 13, fontWeight: 700 },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  subTotalLabel: { fontSize: 11, color: "#78716C" },
  subTotalValue: { fontSize: 11, color: "#78716C" },
  discountLabel: { fontSize: 12, fontWeight: 700, color: "#B4645C" },
  discountValue: { fontSize: 12, fontWeight: 700, color: "#B4645C" },
  totalLabel: { fontSize: 14, fontWeight: 800 },
  totalValue: { fontSize: 16, fontWeight: 800 },
  creditNote: { fontSize: 12, fontWeight: 800, color: "#8A5A1E" },
  methodLine: { fontSize: 11, color: "#78716C", marginTop: 2 },
  servedByLine: { fontSize: 10, color: "#78716C", marginTop: 8 },
  thankYou: {
    textAlign: "center",
    fontSize: 11,
    color: "#78716C",
    marginTop: 4,
  },
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

export default ReceiptModal;


