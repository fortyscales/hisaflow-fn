import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import { supplierService } from "../services/supplierservice";
import SupplierCard from "../components/SupplierCard.jsx";
import SupplierFormModal from "../components/SupplierFormModal.jsx";
import PaySupplierModal from "../components/PaySupplierModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import StickyScreenChrome from "../components/StickyScreenChrome.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { Truck } from "lucide-react";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const SuppliersScreen = () => {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadSuppliers = () =>
    dataService.getSuppliers().then((data) => {
      setSuppliers(data);
      setLoading(false);
    });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleAddSupplier = async (data) => {
    const result = await supplierService.addSupplier(data);
    if (result.success) await loadSuppliers();
    return result;
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await supplierService.deleteSupplier(pendingDeleteId);
      await loadSuppliers();
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete supplier error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handlePayment = async (supplierId, amount, paymentMethod) => {
    const result = await supplierService.recordPayment(
      supplierId,
      amount,
      paymentMethod,
    );
    if (result.success) {
      await loadSuppliers();
      setPayingSupplier(null);
    }
    return result;
  };

  const filteredSuppliers = useMemo(
    () => searchService.searchSuppliers(suppliers, searchQuery),
    [suppliers, searchQuery],
  );

  if (loading) return <LoadingState />;

  const totalOwed = suppliers.reduce(
    (sum, s) => sum + (s.totalSupplied - s.totalPaid),
    0,
  );

  return (
    <div style={styles.wrap}>
      <StickyScreenChrome>
        <ScreenHeader embedded Icon={Truck} title={t("navSuppliers")} subtitle={t("suppliersScreenSubtitle")} actionLabel={t("addSupplierButton")} onAction={() => setShowForm(true)} />
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("searchSuppliersPlaceholder")} style={{ marginBottom: 0 }} />
      </StickyScreenChrome>

      {suppliers.length > 0 && totalOwed > 0 && (
        <div style={styles.summaryBox}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t("totalOwedToSuppliersLabel")}
          </span>
          <span
            style={{ fontSize: 22, fontWeight: 800, color: "var(--danger)" }}
          >
            {formatTZS(totalOwed)}
          </span>
        </div>
      )}


      {filteredSuppliers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {suppliers.length > 0
              ? t("noMatchingSuppliersMessage")
              : t("noSuppliersYet")}
          </div>
          {suppliers.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("tapAddSupplierHint")}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredSuppliers.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onPay={setPayingSupplier}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}

      <SupplierFormModal
        visible={showForm}
        onSave={handleAddSupplier}
        onClose={() => setShowForm(false)}
      />

      <PaySupplierModal
        visible={!!payingSupplier}
        supplier={payingSupplier}
        onSave={handlePayment}
        onClose={() => setPayingSupplier(null)}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteSupplier")}
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

export default SuppliersScreen;


