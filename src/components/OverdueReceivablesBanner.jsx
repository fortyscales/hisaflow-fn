import React, { useMemo } from "react";
import { agingService } from "../services/agingService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) =>
  "TZS " + Math.round(amount || 0).toLocaleString("en-US");

// Deliberately only counts the genuinely overdue buckets (61+ days) —
// a customer who bought on credit two weeks ago isn't a problem worth
// surfacing on the dashboard every day; someone who's owed money for
// three months is exactly the kind of thing easy to lose track of
// without this.
const OverdueReceivablesBanner = ({ creditSales = [], summary = null, onPress }) => {
  const { t } = useLanguage();

  const { customerCount, overdueTotal } = useMemo(() => {
    if (summary) return { customerCount: summary.customerCount || 0, overdueTotal: summary.overdueTotal || 0 };
    const { customers } = agingService.buildReceivablesAging(creditSales);
    let total = 0;
    let count = 0;
    for (const c of customers) {
      const overdue = c.buckets.days61to90 + c.buckets.over90;
      if (overdue > 0) {
        total += overdue;
        count += 1;
      }
    }
    return { customerCount: count, overdueTotal: total };
  }, [creditSales, summary]);

  if (customerCount === 0) return null;

  return (
    <button style={styles.banner} onClick={onPress}>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={styles.title}>{t("overdueReceivablesTitle")}</div>
        <div style={styles.subtitle}>
          {t("overdueReceivablesSummary", {
            count: customerCount,
            amount: formatTZS(overdueTotal),
          })}
        </div>
      </div>
      <span style={styles.chevron}>›</span>
    </button>
  );
};

const styles = {
  banner: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "var(--danger-light)",
    border: "1px solid var(--danger)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    cursor: "pointer",
  },
  title: { fontSize: 13, fontWeight: 700, color: "var(--danger)" },
  subtitle: { fontSize: 12, color: "var(--danger)", marginTop: 2 },
  chevron: { fontSize: 18, color: "var(--danger)", flexShrink: 0 },
};

export default OverdueReceivablesBanner;


