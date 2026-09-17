import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

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

// The physical/printable ticket a customer carries from the staff
// member who wrote up their order to the cashier who fulfills it. The
// order number and issuer are shown first and largest — that pairing is
// the entire point of this document, everything else is secondary.
const OrderTicketModal = ({ visible, order, settings, onClose }) => {
  const { t } = useLanguage();

  if (!visible || !order) return null;

  const handlePrint = () => window.print();
  const businessName = settings?.businessName || "HisaFlow";

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalWrap} onClick={(e) => e.stopPropagation()}>
        <div id="order-ticket-print-area" style={styles.ticket}>
          <div style={styles.center}>
            <div style={styles.businessName}>{businessName}</div>
            <div style={styles.orderNumber}>
              #{String(order.orderNumber).padStart(4, "0")}
            </div>
            <div style={styles.dateText}>{formatDateTime(order.date)}</div>
          </div>

          <div style={styles.divider} />

          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>{t("issuedByLabel")}</span>
            <span style={styles.metaValue}>{order.issuedBy || "—"}</span>
          </div>
          {order.customerName && (
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>
                {t("customerNameLabelShort")}
              </span>
              <span style={styles.metaValue}>{order.customerName}</span>
            </div>
          )}
          {order.customerPhone && (
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>
                {t("customerPhoneLabelShort")}
              </span>
              <span style={styles.metaValue}>{order.customerPhone}</span>
            </div>
          )}

          <div style={styles.divider} />

          {order.items.map((item, idx) => (
            <div key={idx} style={styles.itemRow}>
              <div style={styles.itemName}>{item.productName}{[item.productBrand,item.productSize,item.productUnit].filter(Boolean).length ? <div style={styles.itemMeta}>{[item.productBrand,item.productSize,item.productUnit].filter(Boolean).join(" · ")}</div> : null}</div>
              <div style={styles.itemQty}>× {item.quantity}</div>
            </div>
          ))}

          <div style={styles.divider} />

          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>{t("orderStatusLabel")}</span>
            <span
              style={{
                ...styles.statusValue,
                ...(order.status === "pending"
                  ? styles.statusPending
                  : order.status === "fulfilled"
                    ? styles.statusFulfilled
                    : styles.statusCancelled),
              }}
            >
              {order.status === "pending"
                ? t("orderStatusPending")
                : order.status === "fulfilled"
                  ? t("orderStatusFulfilled")
                  : t("orderStatusCancelled")}
            </span>
          </div>

          <div style={styles.footerNote}>{t("orderTicketFooterNote")}</div>
        </div>

        <div style={styles.actions}>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("closeButton")}
          </button>
          <button style={styles.printBtn} onClick={handlePrint}>
            {t("printButton")}
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
  modalWrap: { width: 340, display: "flex", flexDirection: "column", gap: 12 },
  ticket: {
    background: "var(--surface)",
    borderRadius: 16,
    padding: 24,
    fontFamily: "monospace",
    maxHeight: "75vh",
    overflow: "auto",
  },
  center: { textAlign: "center", marginBottom: 4 },
  businessName: { fontSize: 16, fontWeight: 800, color: "var(--text-primary)" },
  orderNumber: {
    fontSize: 28,
    fontWeight: 800,
    color: "var(--primary-dark)",
    marginTop: 4,
  },
  dateText: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 },
  divider: { borderTop: "1px dashed var(--border)", margin: "12px 0" },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    marginBottom: 4,
  },
  metaLabel: { color: "var(--text-muted)" },
  metaValue: { fontWeight: 700, color: "var(--text-primary)" },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    padding: "4px 0",
  },
  itemName: { color: "var(--text-primary)", fontWeight: 600 },
  itemMeta: { fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 },
  itemQty: { color: "var(--text-secondary)", fontWeight: 700 },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
  },
  statusLabel: { color: "var(--text-muted)" },
  statusValue: {
    fontWeight: 800,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
  },
  statusPending: {
    background: "var(--warning-light)",
    color: "var(--warning)",
  },
  statusFulfilled: {
    background: "var(--success-light)",
    color: "var(--success)",
  },
  statusCancelled: {
    background: "var(--danger-light)",
    color: "var(--danger)",
  },
  footerNote: {
    fontSize: 10,
    color: "var(--text-muted)",
    textAlign: "center",
    marginTop: 16,
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

export default OrderTicketModal;


