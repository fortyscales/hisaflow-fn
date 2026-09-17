import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService.js";
import { agingService } from "../services/agingService.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { Clock } from "lucide-react";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

// Same data CreditScreen already shows — who owes what — reorganized
// around the question an accountant actually asks first: how overdue
// is it. Nothing new to record, nothing new to learn; every credit sale
// already has the date and balance this report is built entirely from.
const ReceivablesAgingScreen = () => {
  const { t } = useLanguage();
  const [creditSales, setCreditSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    dataService.getCreditSales().then((data) => {
      setCreditSales(data);
      setLoading(false);
    });
  }, []);

  const { customers, totals } = useMemo(
    () => agingService.buildReceivablesAging(creditSales),
    [creditSales],
  );
  const filteredCustomers = useMemo(
    () => searchService.searchAgingCustomers(customers, searchQuery),
    [customers, searchQuery],
  );

  if (loading) return <LoadingState />;

  const bucketCards = [
    { key: "current", label: t("agingCurrentLabel"), value: totals.current },
    {
      key: "days31to60",
      label: t("aging31to60Label"),
      value: totals.days31to60,
    },
    {
      key: "days61to90",
      label: t("aging61to90Label"),
      value: totals.days61to90,
    },
    {
      key: "over90",
      label: t("agingOver90Label"),
      value: totals.over90,
      urgent: true,
    },
  ];

  return (
    <div style={styles.screen}>
      <ScreenHeader
        Icon={Clock}
        title={t("navReceivablesAging")}
        subtitle={t("agingSubtitle")}
      />

      <div style={styles.summaryRow}>
        {bucketCards.map((b) => (
          <div
            key={b.key}
            style={{
              ...styles.summaryCard,
              ...(b.urgent && b.value > 0 ? styles.summaryCardUrgent : {}),
            }}
          >
            <div style={styles.summaryLabel}>{b.label}</div>
            <div
              style={{
                ...styles.summaryValue,
                ...(b.urgent && b.value > 0 ? styles.summaryValueUrgent : {}),
              }}
            >
              {formatTZS(b.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.grandTotalRow}>
        <span style={styles.grandTotalLabel}>{t("agingGrandTotalLabel")}</span>
        <span style={styles.grandTotalValue}>
          {formatTZS(totals.grandTotal)}
        </span>
      </div>

      {customers.length > 0 && (
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("searchAgingPlaceholder")}
          style={{ maxWidth: 640 }}
        />
      )}

      {customers.length === 0 ? (
        <div style={styles.empty}>{t("agingNoReceivables")}</div>
      ) : filteredCustomers.length === 0 ? (
        <div style={styles.empty}>{t("noMatchingAgingMessage")}</div>
      ) : (
        <div style={styles.list}>
          {filteredCustomers.map((c) => (
            <div
              key={c.customerPhone || c.customerName}
              style={styles.customerCard}
            >
              <div style={styles.customerTop}>
                <div>
                  <div style={styles.customerName}>{c.customerName}</div>
                  {c.customerPhone && (
                    <div style={styles.customerPhone}>{c.customerPhone}</div>
                  )}
                </div>
                <div style={styles.customerTotal}>
                  {formatTZS(c.totalOutstanding)}
                </div>
              </div>
              <div style={styles.bucketBreakdown}>
                {c.buckets.current > 0 && (
                  <span style={styles.bucketChip}>
                    {t("agingCurrentLabel")}: {formatTZS(c.buckets.current)}
                  </span>
                )}
                {c.buckets.days31to60 > 0 && (
                  <span style={styles.bucketChip}>
                    {t("aging31to60Label")}: {formatTZS(c.buckets.days31to60)}
                  </span>
                )}
                {c.buckets.days61to90 > 0 && (
                  <span
                    style={{
                      ...styles.bucketChip,
                      ...styles.bucketChipWarning,
                    }}
                  >
                    {t("aging61to90Label")}: {formatTZS(c.buckets.days61to90)}
                  </span>
                )}
                {c.buckets.over90 > 0 && (
                  <span
                    style={{ ...styles.bucketChip, ...styles.bucketChipDanger }}
                  >
                    {t("agingOver90Label")}: {formatTZS(c.buckets.over90)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  screen: { flex: 1, minHeight: 0, overflow: "auto", padding: 24 },
  summaryRow: { display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" },
  summaryCard: {
    flex: "1 1 140px",
    background: "var(--surface)",
    borderRadius: 14,
    padding: 16,
    border: "1px solid var(--border-muted)",
  },
  summaryCardUrgent: {
    borderColor: "var(--danger)",
    background: "var(--danger-light)",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryValue: { fontSize: 18, fontWeight: 800, color: "var(--text-primary)" },
  summaryValueUrgent: { color: "var(--danger)" },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    background: "var(--bg)",
    borderRadius: 12,
    marginBottom: 24,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--primary-dark)",
  },
  empty: {
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
    marginTop: 40,
  },
  list: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 },
  customerCard: {
    background: "var(--surface)",
    borderRadius: 14,
    padding: 16,
    border: "1px solid var(--border-muted)",
  },
  customerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  customerName: { fontSize: 15, fontWeight: 700, color: "var(--text-primary)" },
  customerPhone: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  customerTotal: {
    fontSize: 16,
    fontWeight: 800,
    color: "var(--text-primary)",
  },
  bucketBreakdown: { display: "flex", flexWrap: "wrap", gap: 6 },
  bucketChip: {
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
    background: "var(--bg)",
    color: "var(--text-secondary)",
  },
  bucketChipWarning: {
    background: "var(--warning-light)",
    color: "var(--warning)",
  },
  bucketChipDanger: {
    background: "var(--danger-light)",
    color: "var(--danger)",
  },
};

export default ReceivablesAgingScreen;


