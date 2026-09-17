import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import { creditService } from "../services/creditService";
import RecordPaymentModal from "../components/RecordPaymentModal.jsx";
import CreditCard from "../components/CreditCard.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import RemindCustomerModal from "../components/RemindCustomerModal.jsx";
import PaymentReceiptModal from "../components/PaymentReceiptModal.jsx";
import InvoiceModal from "../components/InvoiceModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import StickyScreenChrome from "../components/StickyScreenChrome.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { CreditCard as CreditCardIcon } from "lucide-react";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const CreditScreen = () => {
  const { t } = useLanguage();
  const [creditSales, setCreditSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [payingCreditSale, setPayingCreditSale] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [remindingCreditSale, setRemindingCreditSale] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [invoiceCreditSale, setInvoiceCreditSale] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadCreditSales = () =>
    dataService.getCreditSales().then((data) => {
      setCreditSales(data);
      setLoading(false);
    });

  useEffect(() => {
    loadCreditSales();
    dataService.getSettings().then(setSettings);
  }, []);

  const handleRecordPayment = async (creditSaleId, amount, paymentMethod, account) => {
    const result = await creditService.recordPayment(
      creditSaleId,
      amount,
      paymentMethod,
      account,
    );
    if (result.success) {
      const target = payingCreditSale;
      await loadCreditSales();
      setPayingCreditSale(null);
      if (target) {
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
    }
    return result;
  };

  const confirmDelete = async () => {
    if (deleting) return; // already in flight — a second click here could restore stock twice
    setDeleting(true);
    try {
      const result = await creditService.deleteCreditSale(pendingDeleteId);
      if (result.success) await loadCreditSales();
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete credit sale error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCreditSales = useMemo(
    () =>
      searchService
        .searchCreditSales(creditSales, searchQuery)
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [creditSales, searchQuery],
  );

  if (loading) return <LoadingState />;

  const outstanding = creditSales.filter((cs) => cs.status !== "paid");
  const totalOutstanding = outstanding.reduce(
    (sum, cs) => sum + (cs.totalAmount - cs.amountPaid),
    0,
  );
  return (
    <div style={styles.wrap}>
      <StickyScreenChrome>
        <ScreenHeader embedded Icon={CreditCardIcon} title={t("navCredit")} subtitle={t("creditScreenSubtitle")} />
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("searchCreditPlaceholder")} style={{ marginBottom: 0 }} />
      </StickyScreenChrome>

      {outstanding.length > 0 && (
        <div style={styles.summaryBox}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t("totalOutstandingLabel")}
          </span>
          <span
            style={{ fontSize: 22, fontWeight: 800, color: "var(--danger)" }}
          >
            {formatTZS(totalOutstanding)}
          </span>
        </div>
      )}


      {filteredCreditSales.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {creditSales.length > 0
              ? t("noMatchingCreditSalesMessage")
              : t("noCreditSalesYet")}
          </div>
          {creditSales.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("creditSalesHint")}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredCreditSales.map((cs) => (
            <div key={cs.id}>
              <CreditCard
                creditSale={cs}
                onPayment={setPayingCreditSale}
                onDelete={setPendingDeleteId}
                onRemindCustomer={setRemindingCreditSale}
              />
              <button style={styles.invoiceBtn} onClick={() => setInvoiceCreditSale(cs)}>
                Create / View Invoice
              </button>
            </div>
          ))}
        </div>
      )}

      <RecordPaymentModal
        visible={!!payingCreditSale}
        creditSale={payingCreditSale}
        paymentAccounts={settings.paymentAccounts || []}
        onSave={handleRecordPayment}
        onClose={() => setPayingCreditSale(null)}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteCreditSale")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        busy={deleting}
      />

      <RemindCustomerModal
        visible={!!remindingCreditSale}
        customerName={remindingCreditSale?.customerName}
        customerPhone={remindingCreditSale?.customerPhone}
        onClose={() => setRemindingCreditSale(null)}
      />

      <InvoiceModal
        visible={!!invoiceCreditSale}
        creditSale={invoiceCreditSale}
        settings={settings}
        onClose={() => setInvoiceCreditSale(null)}
      />

      <PaymentReceiptModal
        visible={!!paymentReceipt}
        payment={paymentReceipt}
        businessName={settings.businessName}
        onClose={() => setPaymentReceipt(null)}
      />
    </div>
  );
};

const styles = {
  wrap: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    maxWidth: 1080,
    margin: "0 auto",
    width: "100%",
  },
  summaryBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--danger-light)",
    borderRadius: 16,
    padding: "16px 20px",
    marginBottom: 20,
  },
  emptyState: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 48,
    textAlign: "center",
  },
  invoiceBtn: { width: "100%", marginTop: 6, padding: 9, borderRadius: 10, border: "1px solid var(--border-muted)", background: "var(--surface)", color: "var(--primary)", fontWeight: 700, cursor: "pointer" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 14,
  },
};

export default CreditScreen;


