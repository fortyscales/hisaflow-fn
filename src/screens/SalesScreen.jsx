import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import SaleFormModal from "../components/SaleFormModal.jsx";
import SaleCard from "../components/SaleCard.jsx";
import ReceiptModal from "../components/ReceiptModal.jsx";
import EditSaleModal from "../components/EditSaleModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Pagination from "../components/Pagination.jsx";
import { salesService } from "../services/salesService";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { ShoppingCart } from "lucide-react";
import InvoiceModal from "../components/InvoiceModal.jsx";

const SalesScreen = ({ currentUser }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [invoiceSale, setInvoiceSale] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [pendingDeleteSale, setPendingDeleteSale] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSales, setTotalSales] = useState(0);

  const loadPage = async (page = currentPage, search = searchQuery) => {
    const result = await dataService.getSalesPage({ page, pageSize: PAGE_SIZE, search });
    setSales(result.items);
    setTotalPages(result.totalPages);
    setTotalSales(result.total);
  };

  const loadAll = async () => {
    const [p] = await Promise.all([dataService.getProducts(), loadPage()]);
    setProducts(p);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    dataService.getSettings().then(setSettings);
  }, []);

  const confirmDeleteSale = async (reason) => {
    setDeleteError("");
    try {
      const result = await salesService.deleteSale(
        pendingDeleteSale.id,
        reason,
      );
      if (!result.success) {
        setDeleteError(result.error || t("unexpectedErrorTryAgain"));
        return;
      }
      await loadAll();
      setPendingDeleteSale(null);
    } catch (err) {
      console.error("Delete sale error:", err);
      setDeleteError(t("unexpectedErrorTryAgain"));
    }
  };

  // Search and pagination execute in SQLite. The renderer only holds the current
  // page, keeping this screen fast even after years of transactions.
  const recentSales = sales;
  const pagedSales = sales;

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      setCurrentPage(1);
      loadPage(1, searchQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (loading || currentPage === 1) return;
    loadPage(currentPage, searchQuery);
  }, [currentPage]);

  if (loading) return <LoadingState />;

  return (
    <div style={styles.wrap}>
      <ScreenHeader
        Icon={ShoppingCart}
        title={t("navSales")}
        subtitle={t("salesScreenSubtitle")}
        actionLabel={t("sellProductButton")}
        onAction={() => setShowForm(true)}
      />

      <div style={styles.searchBar}>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("searchSalesPlaceholder")}
          style={{ marginBottom: 0 }}
        />
        {searchQuery.trim() && (
          <button style={styles.clearSearchBtn} onClick={() => setSearchQuery("")}>
            {t("clearSearchButton") || "Clear search"}
          </button>
        )}
      </div>

      {recentSales.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {searchQuery.trim() ? t("noMatchingSalesMessage") : t("noSalesYet")}
          </div>
          {!searchQuery.trim() && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {products.length === 0
                ? t("addProductsFirstHint")
                : t("tapSellProductHint")}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={styles.grid}>
            {pagedSales.map((s) => (
              <SaleCard
                key={s.id}
                sale={s}
                currentUser={currentUser}
                onEdit={s.recordType === "credit" ? null : setEditingSale}
                onDelete={s.recordType === "credit" ? null : setPendingDeleteSale}
                onInvoice={s.recordType === "credit" ? null : setInvoiceSale}
              />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <SaleFormModal
        visible={showForm}
        products={products}
        onCompleted={(saleData) => {
          loadAll();
          setShowForm(false);
          setReceiptSale(saleData);
        }}
        onClose={() => setShowForm(false)}
      />

      <ReceiptModal
        visible={!!receiptSale}
        sale={receiptSale}
        settings={settings}
        onClose={() => setReceiptSale(null)}
      />

      <InvoiceModal visible={!!invoiceSale} sale={invoiceSale} settings={settings} onClose={() => setInvoiceSale(null)} />

      <EditSaleModal
        visible={!!editingSale}
        sale={editingSale}
        onSaved={() => {
          loadAll();
          setEditingSale(null);
        }}
        onClose={() => setEditingSale(null)}
      />

      <ConfirmModal
        visible={!!pendingDeleteSale}
        message={t("confirmDeleteSaleMessage")}
        error={deleteError}
        reasonLabel={t("editReasonLabel")}
        reasonPlaceholder={t("editReasonPlaceholder")}
        onConfirm={confirmDeleteSale}
        onCancel={() => {
          setPendingDeleteSale(null);
          setDeleteError("");
        }}
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
  searchBar: {
    position: "sticky",
    top: 78,
    zIndex: 18,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    padding: "10px 0 12px",
    background: "var(--bg)",
  },
  clearSearchBtn: {
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    borderRadius: 12,
    padding: "0 14px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
}

export default SalesScreen;


