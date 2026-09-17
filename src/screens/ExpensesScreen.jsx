import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import ExpenditureFormModal from "../components/ExpenditureFormModal.jsx";
import ExpenditureCard from "../components/ExpenditureCard.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { activityLogService } from "../services/ActivityLogService";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { Wallet } from "lucide-react";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const ExpensesScreen = () => {
  const { t } = useLanguage();
  const [expenditures, setExpenditures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState({});

  useEffect(() => {
    dataService.getExpenditures().then((data) => {
      setExpenditures(data);
      setLoading(false);
    });
    dataService.getSettings().then(setSettings);
  }, []);

  const handleSave = async (expenditure) => {
    await dataService.addExpenditure(expenditure);
    setExpenditures((current) => [...current, expenditure]);
    setShowForm(false);
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const removed = expenditures.find((exp) => exp.id === pendingDeleteId);
      await dataService.deleteExpenditure(pendingDeleteId);
      setExpenditures((current) => current.filter((exp) => exp.id !== pendingDeleteId));
      if (removed)
        await activityLogService.logActivity(
          "deleted an expense",
          removed.description,
        );
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete expenditure error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredSorted = useMemo(
    () =>
      searchService
        .searchExpenditures(expenditures, searchQuery)
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [expenditures, searchQuery],
  );

  if (loading) return <LoadingState />;

  const totalThisList = expenditures.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  return (
    <div style={styles.wrap}>
      <ScreenHeader
        Icon={Wallet}
        title={t("navExpenses")}
        subtitle={t("expensesScreenSubtitle")}
        actionLabel={t("addExpenditureButton")}
        onAction={() => setShowForm(true)}
      />

      {expenditures.length > 0 && (
        <div style={styles.summaryBox}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t("totalExpensesLabel")}
          </span>
          <span
            style={{ fontSize: 22, fontWeight: 800, color: "var(--danger)" }}
          >
            {formatTZS(totalThisList)}
          </span>
        </div>
      )}

      {expenditures.length > 0 && (
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("searchExpensesPlaceholder")}
        />
      )}

      {filteredSorted.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {expenditures.length > 0
              ? t("noMatchingExpensesMessage")
              : t("noExpensesYet")}
          </div>
          {expenditures.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("tapAddExpenditureHint")}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredSorted.map((exp) => (
            <ExpenditureCard
              key={exp.id}
              expenditure={exp}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}

      <ExpenditureFormModal
        visible={showForm}
        paymentAccounts={settings.paymentAccounts || []}
        onSave={handleSave}
        onClose={() => setShowForm(false)}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteExpenditure")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        busy={deleting}
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 14,
  },
};

export default ExpensesScreen;


