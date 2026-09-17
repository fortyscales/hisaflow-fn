import React, { useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "./LoadingState.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const formatDate = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("sw-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on receipt" },
  { value: "net_15", label: "Net 15 days" },
  { value: "net_30", label: "Net 30 days" },
  { value: "net_60", label: "Net 60 days" },
];

const paymentTermsLabel = (value) =>
  PAYMENT_TERMS_OPTIONS.find((o) => o.value === value)?.label || value;

// creditSale = { id, customerName, customerPhone, totalAmount, date }
const InvoiceModal = ({ visible, creditSale, sale, settings, onClose }) => {
  const source = creditSale || sale;
  const isCredit = !!creditSale;
  const { t } = useLanguage();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerTin, setCustomerTin] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("due_on_receipt");
  const [invoiceKind, setInvoiceKind] = useState("standard");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerRegistrationNo, setCustomerRegistrationNo] = useState("");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible || !source) return;
    setLoading(true);
    setCustomerName(source.customerName || "");
    setCustomerPhone(source.customerPhone || "");
    const getter = isCredit ? dataService.getInvoiceByCreditSaleId : dataService.getInvoiceBySaleId;
    getter(source.id).then((existing) => {
      setInvoice(existing);
      setLoading(false);
    });
  }, [visible, source?.id, isCredit]);

  if (!visible || !source) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const details = {
        invoiceKind, customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        customerCompany: customerCompany.trim(), customerAddress: customerAddress.trim(),
        customerTin: customerTin.trim(), customerEmail: customerEmail.trim(),
        customerRegistrationNo: customerRegistrationNo.trim(), purchaseOrderNo: purchaseOrderNo.trim(),
        notes: notes.trim(), paymentTerms,
      };
      if (invoiceKind === "b2b" && !customerCompany.trim()) throw new Error("B2B_COMPANY_REQUIRED");
      if (isCredit) await dataService.createInvoice(source.id, details);
      else await dataService.createSaleInvoice(source.id, details);
      const fullInvoice = isCredit
        ? await dataService.getInvoiceByCreditSaleId(source.id)
        : await dataService.getInvoiceBySaleId(source.id);
      setInvoice(fullInvoice);
    } catch (err) {
      console.error("Invoice generation error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <LoadingState fullScreen={false} />;

  // Not generated yet - capture the B2B-specific details a receipt
  // never needed.
  if (!invoice) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.formWrap} onClick={(e) => e.stopPropagation()}>
          <h3 style={styles.formTitle}>{t("generateInvoiceTitle")}</h3>
          <p style={styles.formSub}>
            {source.customerName || source.productName || "Sale"} — {formatTZS(source.totalAmount ?? source.totalRevenue)}
          </p>

          <label style={styles.label}>Invoice type</label>
          <select style={styles.input} value={invoiceKind} onChange={(e)=>setInvoiceKind(e.target.value)}>
            <option value="standard">Standard invoice</option><option value="b2b">B2B / Company invoice</option>
          </select>
          <label style={styles.label}>Customer / contact name</label>
          <input style={styles.input} value={customerName} onChange={(e)=>setCustomerName(e.target.value)} />
          <label style={styles.label}>Customer phone</label>
          <input style={styles.input} value={customerPhone} onChange={(e)=>setCustomerPhone(e.target.value)} />
          <label style={styles.label}>{t("customerCompanyLabel")}</label>
          <input
            style={styles.input}
            value={customerCompany}
            onChange={(e) => setCustomerCompany(e.target.value)}
            placeholder={t("customerCompanyPlaceholder")}
          />

          <label style={styles.label}>{t("customerAddressLabel")}</label>
          <input
            style={styles.input}
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />

          <label style={styles.label}>{t("customerTinLabel")}</label>
          <input
            style={styles.input}
            value={customerTin}
            onChange={(e) => setCustomerTin(e.target.value)}
          />

          {invoiceKind === "b2b" && <>
            <label style={styles.label}>Company email</label><input style={styles.input} value={customerEmail} onChange={(e)=>setCustomerEmail(e.target.value)} />
            <label style={styles.label}>Company registration no.</label><input style={styles.input} value={customerRegistrationNo} onChange={(e)=>setCustomerRegistrationNo(e.target.value)} />
            <label style={styles.label}>Purchase order / reference no.</label><input style={styles.input} value={purchaseOrderNo} onChange={(e)=>setPurchaseOrderNo(e.target.value)} />
          </>}
          <label style={styles.label}>Invoice notes</label><input style={styles.input} value={notes} onChange={(e)=>setNotes(e.target.value)} />
          <label style={styles.label}>{t("paymentTermsLabel")}</label>
          <select
            style={styles.input}
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
          >
            {PAYMENT_TERMS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <button style={styles.closeBtn} onClick={onClose}>
              {t("cancelButton")}
            </button>
            <button
              style={styles.printBtn}
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? t("completing") : t("generateInvoiceButton")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Already generated - show the formatted, printable document.
  const businessName = settings?.businessName || "HisaFlow";
  const businessAddress = settings?.businessAddress || "";
  const invoiceTax = Number(invoice.tax || 0);
  const invoiceDiscount = Number(invoice.discount || 0);
  const invoiceSubtotal = Number(invoice.subtotal || invoice.total || 0);
  const vatEnabled = invoiceTax > 0 || !!settings?.vatEnabled;
  const vatRate = invoiceTax > 0 ? Number(invoice.taxRate || 0) : (settings?.vatRate || 18);
  const totalExclVat = invoiceTax > 0 ? Math.max(0, invoiceSubtotal - invoiceDiscount) : (vatEnabled ? invoice.total / (1 + vatRate / 100) : invoice.total);
  const vatAmount = invoiceTax > 0 ? invoiceTax : (vatEnabled ? invoice.total - totalExclVat : 0);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalWrap} onClick={(e) => e.stopPropagation()}>
        <div id="invoice-print-area" style={styles.invoice}>
          <div style={styles.headerRow}>
            <div>
              <div style={styles.businessName}>{businessName}</div>
              {businessAddress && (
                <div style={styles.smallLine}>{businessAddress}</div>
              )}
              {(settings?.tin || settings?.vrn) && (
                <div style={styles.smallLine}>
                  {settings.tin ? `TIN: ${settings.tin}` : ""}
                  {settings.tin && settings.vrn ? " · " : ""}
                  {settings.vrn ? `VRN: ${settings.vrn}` : ""}
                </div>
              )}
            </div>
            <div style={styles.invoiceMeta}>
              <div style={styles.invoiceTitle}>{t("invoiceLabel")}</div>
              <div style={styles.smallLine}>
                INV-{String(invoice.invoiceNumber).padStart(4, "0")}
              </div>
              <div style={styles.smallLine}>{formatDate(invoice.date)}</div>
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.billToBlock}>
            <div style={styles.billToLabel}>{t("billToLabel")}</div>
            <div style={styles.billToName}>
              {invoice.customerCompany || invoice.customerName}
            </div>
            {invoice.customerCompany && (
              <div style={styles.smallLine}>{invoice.customerName}</div>
            )}
            {invoice.customerAddress && (
              <div style={styles.smallLine}>{invoice.customerAddress}</div>
            )}
            {invoice.customerPhone && (
              <div style={styles.smallLine}>{invoice.customerPhone}</div>
            )}
            {invoice.customerTin && (
              <div style={styles.smallLine}>TIN: {invoice.customerTin}</div>
            )}
            {invoice.customerRegistrationNo && <div style={styles.smallLine}>Reg No: {invoice.customerRegistrationNo}</div>}
            {invoice.customerEmail && <div style={styles.smallLine}>{invoice.customerEmail}</div>}
            {invoice.purchaseOrderNo && <div style={styles.smallLine}>PO / Ref: {invoice.purchaseOrderNo}</div>}
          </div>

          <div style={styles.smallLine}>
            {t("paymentTermsLabel")}: {paymentTermsLabel(invoice.paymentTerms)}
          </div>

          <div style={styles.divider} />

          {invoice.items.map((item, idx) => (
            <div key={idx} style={styles.itemRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.itemName}>{item.productName}</div>
                <div style={styles.itemSub}>
                  {item.quantity} × {formatTZS(item.sellingPrice)}
                </div>
              </div>
              <div style={styles.itemTotal}>
                {formatTZS(item.quantity * item.sellingPrice)}
              </div>
            </div>
          ))}

          <div style={styles.divider} />

          {invoiceDiscount > 0 && (
            <>
              <div style={styles.totalRow}><span style={styles.subTotalLabel}>Subtotal</span><span style={styles.subTotalValue}>{formatTZS(invoiceSubtotal)}</span></div>
              <div style={styles.totalRow}><span style={styles.subTotalLabel}>Discount</span><span style={styles.subTotalValue}>− {formatTZS(invoiceDiscount)}</span></div>
            </>
          )}
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
                <span style={styles.totalValue}>
                  {formatTZS(invoice.total)}
                </span>
              </div>
            </>
          ) : (
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>{t("tableTotal")}</span>
              <span style={styles.totalValue}>{formatTZS(invoice.total)}</span>
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button style={styles.printBtn} onClick={handlePrint}>
            {t("printInvoiceButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  modalWrap: { width: 380 },
  formWrap: {
    width: 340,
    background: "white",
    borderRadius: 12,
    padding: 20,
  },
  formTitle: { fontSize: 16, fontWeight: 800, margin: 0 },
  formSub: { fontSize: 13, color: "#78716C", marginTop: 4, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: 700, marginTop: 12, display: "block" },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    marginTop: 4,
    fontSize: 13,
    boxSizing: "border-box",
  },
  invoice: {
    background: "white",
    borderRadius: 12,
    padding: 24,
    color: "#292524",
    marginBottom: 16,
  },
  headerRow: { display: "flex", justifyContent: "space-between" },
  businessName: { fontSize: 16, fontWeight: 800 },
  smallLine: { fontSize: 11, color: "#78716C", marginTop: 2 },
  invoiceMeta: { textAlign: "right" },
  invoiceTitle: { fontSize: 13, fontWeight: 800, letterSpacing: 1 },
  divider: { borderTop: "1px dashed #A8A29E", margin: "12px 0" },
  billToBlock: { marginBottom: 8 },
  billToLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#A8A29E",
    textTransform: "uppercase",
  },
  billToName: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemName: { fontSize: 13, fontWeight: 700 },
  itemSub: { fontSize: 11, color: "#78716C", marginTop: 1 },
  itemTotal: { fontSize: 13, fontWeight: 700 },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  subTotalLabel: { fontSize: 11, color: "#78716C" },
  subTotalValue: { fontSize: 11, color: "#78716C" },
  totalLabel: { fontSize: 14, fontWeight: 800 },
  totalValue: { fontSize: 16, fontWeight: 800 },
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

export default InvoiceModal;


