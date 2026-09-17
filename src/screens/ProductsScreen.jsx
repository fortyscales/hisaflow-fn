import React, { useState, useEffect, useMemo, useRef } from "react";
import { dataService } from "../services/DataService";
import ProductFormModal from "../components/ProductFormModal.jsx";
import ImportProductsModal from "../components/ImportProductsModal.jsx";
import UndoToast from "../components/UndoToast.jsx";
import ProductCard from "../components/ProductCard.jsx";
import SaleFormModal from "../components/SaleFormModal.jsx";
import CartBar from "../components/CartBar.jsx";
import CartModal from "../components/CartModal.jsx";
import AddStockModal from "../components/AddStockModal.jsx";
import RestockCartBar from "../components/RestockCartBar.jsx";
import RestockCartModal from "../components/RestockCartModal.jsx";
import ReceiptModal from "../components/ReceiptModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import PosterModal from "../components/PosterModal.jsx";
import NotifyPastBuyersModal from "../components/NotifyPastBuyersModal.jsx";
import BatchListModal from "../components/BatchListModal.jsx";
import Pagination from "../components/Pagination.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useRestockCart } from "../context/RestockCartContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { restockService } from "../services/restockService";
import { productService } from "../services/productService";
import { activityLogService } from "../services/ActivityLogService";
import { sampleDataService } from "../services/SampleDataService";
import { filterService } from "../services/filterService";
import { searchService } from "../services/searchService";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import StickyScreenChrome from "../components/StickyScreenChrome.jsx";
import { Package } from "lucide-react";

const ProductsScreen = ({ initialFilter }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showBestSellers, setShowBestSellers] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all"); // all | low-stock | out-of-stock
  const [expiryFilter, setExpiryFilter] = useState(
    initialFilter?.expiryFilter || "all",
  ); // all | expired
  const [sortBy, setSortBy] = useState("created"); // created | name | price | stock
  const [sortOrder, setSortOrder] = useState("desc"); // desc on 'created' means newest first
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [quickSellProductId, setQuickSellProductId] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState(null);
  const [showRestockCart, setShowRestockCart] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [showPoster, setShowPoster] = useState(false);
  const [notifyBuyersProduct, setNotifyBuyersProduct] = useState(null);
  const [viewingBatchesProduct, setViewingBatchesProduct] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showNotifyPicker, setShowNotifyPicker] = useState(false);
  const [notifyPickerProductId, setNotifyPickerProductId] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [pendingUndo, setPendingUndo] = useState(null);
  const pendingUndoRef = useRef(null);
  const UNDO_WINDOW_MS = 6000;
  const { addToCart } = useCart();
  const { addToRestockCart } = useRestockCart();

  const loadProducts = () =>
    dataService.getProducts().then((data) => {
      setProducts(data);
      setLoading(false);
    });

  useEffect(() => {
    loadProducts();
    dataService.getSales().then(setSales);
    dataService.getSettings().then(setSettings);
  }, []);

  const handleSaveProduct = async ({
    product,
    supplierLink,
    stockPaymentMethod,
    stockPaymentAccount,
  }) => {
    const updated = await productService.saveProduct({
      product,
      supplierLink,
      stockPaymentMethod,
      stockPaymentAccount,
      existingProducts: products,
    });
    setProducts(updated);
    setShowForm(false);
    setEditingProduct(null);
  };

  useEffect(() => {
    pendingUndoRef.current = pendingUndo;
  }, [pendingUndo]);

  // Commits deletion is deliberately fire-and-forget when called from
  // an expiring timer or an unmount cleanup — there's nothing to await
  // into at that point, and the alternative (blocking navigation on a
  // save) would be worse than a delete that finishes a moment after the
  // person has already moved on.
  const commitDeletion = (remainingProducts, removedProducts) => {
    dataService.deleteProducts(removedProducts.map((p) => p.id));
    if (removedProducts.length === 1) {
      activityLogService.logActivity(
        "deleted a product",
        removedProducts[0].name,
      );
    } else if (removedProducts.length > 1) {
      activityLogService.logActivity(
        "deleted multiple products",
        `${removedProducts.length} bidhaa`,
      );
    }
  };

  // A second delete while the first is still pending commits the first
  // immediately rather than losing it or stacking two timers — only one
  // deletion is ever "undoable" at a time, which is also just easier to
  // reason about as a person using it.
  const scheduleUndo = (
    originalProducts,
    remainingProducts,
    removedProducts,
  ) => {
    if (pendingUndoRef.current) {
      clearTimeout(pendingUndoRef.current.timeoutId);
      commitDeletion(
        pendingUndoRef.current.remainingProducts,
        pendingUndoRef.current.removedProducts,
      );
    }
    const timeoutId = setTimeout(() => {
      commitDeletion(remainingProducts, removedProducts);
      setPendingUndo(null);
    }, UNDO_WINDOW_MS);
    setPendingUndo({
      originalProducts,
      remainingProducts,
      removedProducts,
      timeoutId,
    });
  };

  const handleUndo = () => {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timeoutId);
    setProducts(pendingUndo.originalProducts);
    setPendingUndo(null);
  };

  // If the person navigates away while a deletion is still undoable, it
  // commits immediately rather than being silently lost, or firing a
  // setState after this screen has already unmounted.
  useEffect(() => {
    return () => {
      if (pendingUndoRef.current) {
        clearTimeout(pendingUndoRef.current.timeoutId);
        commitDeletion(
          pendingUndoRef.current.remainingProducts,
          pendingUndoRef.current.removedProducts,
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (productId) => setPendingDeleteId(productId);

  const confirmDelete = () => {
    const removed = products.find((p) => p.id === pendingDeleteId);
    if (!removed) {
      setPendingDeleteId(null);
      return;
    }
    const remaining = products.filter((p) => p.id !== pendingDeleteId);
    setProducts(remaining);
    setPendingDeleteId(null);
    scheduleUndo(products, remaining, [removed]);
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelectProduct = (productId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Selecting "all" means all currently visible (filtered/searched)
  // products, not every product in the shop — deleting should only ever
  // affect what the person can actually see and reason about right now.
  const selectAllVisible = () =>
    setSelectedIds(new Set(displayedProducts.map((p) => p.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const confirmBulkDelete = () => {
    const removed = products.filter((p) => selectedIds.has(p.id));
    const remaining = products.filter((p) => !selectedIds.has(p.id));
    setProducts(remaining);
    setSelectedIds(new Set());
    setSelectMode(false);
    setPendingBulkDelete(false);
    scheduleUndo(products, remaining, removed);
  };

  const handleAddSampleProducts = async () => {
    setLoadingSample(true);
    await sampleDataService.addSampleProducts();
    await loadProducts();
    await activityLogService.logActivity("added sample products", "");
    setLoadingSample(false);
  };

  const handleAddStockComplete = async ({
    productId,
    quantity,
    buyingPrice,
    supplierId,
    supplierName,
    paymentMethod,
  }) => {
    const result = await restockService.addStock({
      productId,
      quantity,
      buyingPrice,
      supplierId,
      supplierName,
      paymentMethod,
    });
    if (result.success) {
      await loadProducts();
      setAddStockProduct(null);
    }
    return result;
  };

  const categories = useMemo(
    () => filterService.getCategories(products),
    [products],
  );
  const brands = useMemo(() => filterService.getBrands(products), [products]);

  // Search first, then attribute filters, then either a best-sellers
  // ranking or the chosen sort — search narrows the working set before
  // anything else touches it, same order the phone app uses. Recomputes
  // only when something that actually affects the result changes, not on
  // every render — this list was previously rebuilt from scratch even
  // when, say, an unrelated modal opened.
  const displayedProducts = useMemo(() => {
    const quantityByProduct = {};
    sales.forEach((s) => {
      quantityByProduct[s.productId] =
        (quantityByProduct[s.productId] || 0) + (s.quantity || 0);
    });

    let result = searchService.searchProducts(products, searchQuery);
    result = filterService.filterProducts(result, {
      category: categoryFilter,
      brand: brandFilter,
      stockStatus: stockStatusFilter,
    });

    if (expiryFilter === "expired") {
      result = result.filter((p) => {
        if (!p.expiryDate) return false;
        const days = Math.ceil(
          (new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24),
        );
        return days < 0;
      });
    }

    if (showBestSellers) {
      return result
        .filter((p) => quantityByProduct[p.id] > 0)
        .sort(
          (a, b) =>
            (quantityByProduct[b.id] || 0) - (quantityByProduct[a.id] || 0),
        );
    }
    return filterService.filterProducts(result, { sortBy, sortOrder });
  }, [
    products,
    sales,
    searchQuery,
    categoryFilter,
    brandFilter,
    stockStatusFilter,
    expiryFilter,
    showBestSellers,
    sortBy,
    sortOrder,
  ]);

  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(displayedProducts.length / PAGE_SIZE),
  );
  const pagedProducts = useMemo(
    () =>
      displayedProducts.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [displayedProducts, currentPage],
  );

  // Resets to page 1 when the person changes what they're looking for —
  // finishing a sale on page 3 shouldn't yank them back to page 1, but
  // typing a new search term should, since "page 3" of the old results
  // means nothing once the results themselves have changed.
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    categoryFilter,
    brandFilter,
    stockStatusFilter,
    expiryFilter,
    showBestSellers,
    sortBy,
    sortOrder,
  ]);

  // Safety clamp: if products were deleted while on a later page and
  // that page no longer exists, land on the last real page instead of
  // showing an empty screen with no way back.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (loading) return <LoadingState />;

  return (
    <div style={styles.wrap}>
      <StickyScreenChrome>
      <ScreenHeader embedded
        Icon={Package}
        title={t("navProducts")}
        subtitle={t("stockScreenSubtitle")}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.posterBtn} onClick={() => setShowPoster(true)}>
            {t("createPosterButton")}
          </button>
          <button style={styles.posterBtn} onClick={() => setShowImport(true)}>
            {t("importFromExcelButton")}
          </button>
          <button
            style={styles.posterBtn}
            onClick={() => setShowNotifyPicker(true)}
          >
            {t("sendReminderButton")}
          </button>
          <button style={styles.posterBtn} onClick={toggleSelectMode}>
            {selectMode ? t("cancelButton") : t("selectButton")}
          </button>
          <button
            style={styles.addBtn}
            onClick={() => {
              setEditingProduct(null);
              setShowForm(true);
            }}
          >
            {t("addProductButton")}
          </button>
        </div>
      </ScreenHeader>

      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t("searchProductsPlaceholder")}
        style={{ ...styles.searchInput, marginBottom: 0 }}
      />
      </StickyScreenChrome>

      <div style={styles.filterRow}>
        <button
          style={{
            ...styles.filterBtn,
            ...(showBestSellers ? styles.filterBtnActive : {}),
          }}
          onClick={() => setShowBestSellers(!showBestSellers)}
        >
          {t("popularProductsFilter")}
        </button>

        {categories.length > 0 && (
          <select
            style={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{t("allCategoriesOption")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {brands.length > 0 && (
          <select
            style={styles.filterSelect}
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="all">{t("allBrandsOption")}</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}

        <select
          style={styles.filterSelect}
          value={stockStatusFilter}
          onChange={(e) => setStockStatusFilter(e.target.value)}
        >
          <option value="all">{t("allStockOption")}</option>
          <option value="low-stock">{t("lowStockOption")}</option>
          <option value="out-of-stock">{t("outOfStockOption")}</option>
        </select>

        {expiryFilter === "expired" && (
          <button
            style={styles.expiryFilterChip}
            onClick={() => setExpiryFilter("all")}
          >
            {t("expiredOnlyFilterLabel")} ×
          </button>
        )}

        {!showBestSellers && (
          <>
            <select
              style={styles.filterSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created">{t("sortByNewestOption")}</option>
              <option value="name">{t("sortByNameOption")}</option>
              <option value="price">{t("sortByPriceOption")}</option>
              <option value="stock">{t("sortByStockOption")}</option>
            </select>
            <button
              style={styles.sortOrderBtn}
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={
                sortOrder === "asc" ? t("ascendingLabel") : t("descendingLabel")
              }
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </>
        )}
      </div>

      {products.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t("noProductsYet")}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            {t("tapAddProductHint")}
          </div>
          <button
            style={styles.sampleDataBtn}
            disabled={loadingSample}
            onClick={handleAddSampleProducts}
          >
            {loadingSample ? t("completing") : t("addSampleProductsButton")}
          </button>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {showBestSellers
              ? t("noPopularProductsYet")
              : t("noMatchingProductsMessage")}
          </div>
        </div>
      ) : (
        <>
          {selectMode && (
            <div style={styles.selectionBar}>
              <span style={styles.selectionCount}>
                {t("selectedCountLabel", { count: selectedIds.size })}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={styles.selectionLinkBtn}
                  onClick={selectAllVisible}
                >
                  {t("selectAllButton")}
                </button>
                <button style={styles.selectionLinkBtn} onClick={deselectAll}>
                  {t("deselectAllButton")}
                </button>
                <button
                  style={{
                    ...styles.selectionDeleteBtn,
                    opacity: selectedIds.size === 0 ? 0.4 : 1,
                  }}
                  disabled={selectedIds.size === 0}
                  onClick={() => setPendingBulkDelete(true)}
                >
                  {t("deleteSelectedButton")}
                </button>
              </div>
            </div>
          )}
          <div style={styles.grid}>
            {pagedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={(prod) => {
                  setEditingProduct(prod);
                  setShowForm(true);
                }}
                onDelete={handleDelete}
                onQuickSell={(prod) => setQuickSellProductId(prod.id)}
                onAddToCart={addToCart}
                onAddStock={(prod) => setAddStockProduct(prod)}
                onAddToRestockCart={addToRestockCart}
                onViewBatches={setViewingBatchesProduct}
                selectMode={selectMode}
                isSelected={selectedIds.has(p.id)}
                onToggleSelect={toggleSelectProduct}
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

      <ProductFormModal
        visible={showForm}
        editingProduct={editingProduct}
        existingProducts={products}
        onSave={handleSaveProduct}
        onClose={() => {
          setShowForm(false);
          setEditingProduct(null);
        }}
      />

      <ImportProductsModal
        visible={showImport}
        existingProducts={products}
        onImported={loadProducts}
        onClose={() => setShowImport(false)}
      />

      <SaleFormModal
        visible={!!quickSellProductId}
        products={products}
        preSelectedProductId={quickSellProductId}
        onCompleted={(saleData) => {
          loadProducts();
          setQuickSellProductId(null);
          setReceiptSale(saleData);
        }}
        onClose={() => setQuickSellProductId(null)}
      />

      <CartModal
        visible={showCart}
        onClose={() => setShowCart(false)}
        onCompleted={(saleData) => {
          setShowCart(false);
          loadProducts();
          setReceiptSale(saleData);
        }}
      />

      <AddStockModal
        visible={!!addStockProduct}
        product={addStockProduct}
        onSave={handleAddStockComplete}
        onClose={() => setAddStockProduct(null)}
      />

      <RestockCartModal
        visible={showRestockCart}
        onClose={() => setShowRestockCart(false)}
        onCompleted={() => {
          setShowRestockCart(false);
          loadProducts();
        }}
      />

      <div style={styles.floatingStack}>
        <CartBar onOpenCart={() => setShowCart(true)} />
        <RestockCartBar onOpenCart={() => setShowRestockCart(true)} />
      </div>

      <ReceiptModal
        visible={!!receiptSale}
        sale={receiptSale}
        settings={settings}
        onClose={() => setReceiptSale(null)}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteProduct")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <ConfirmModal
        visible={pendingBulkDelete}
        message={t("confirmBulkDeleteProducts", { count: selectedIds.size })}
        onConfirm={confirmBulkDelete}
        onCancel={() => setPendingBulkDelete(false)}
      />

      <PosterModal visible={showPoster} onClose={() => setShowPoster(false)} />

      {showNotifyPicker && (
        <div
          style={styles.pickerOverlay}
          onClick={() => {
            setShowNotifyPicker(false);
            setNotifyPickerProductId("");
          }}
        >
          <div style={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.pickerTitle}>{t("sendReminderButton")}</h2>
            <label style={styles.pickerLabel}>
              {t("selectProductPlaceholder")}
            </label>
            <select
              style={styles.pickerSelect}
              value={notifyPickerProductId}
              onChange={(e) => setNotifyPickerProductId(e.target.value)}
            >
              <option value="">{t("selectProductPlaceholder")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div style={styles.pickerActions}>
              <button
                style={styles.pickerCancelBtn}
                onClick={() => {
                  setShowNotifyPicker(false);
                  setNotifyPickerProductId("");
                }}
              >
                {t("cancelButton")}
              </button>
              <button
                style={styles.pickerContinueBtn}
                disabled={!notifyPickerProductId}
                onClick={() => {
                  const product = products.find(
                    (p) => p.id === notifyPickerProductId,
                  );
                  setNotifyBuyersProduct(product);
                  setShowNotifyPicker(false);
                  setNotifyPickerProductId("");
                }}
              >
                {t("continueButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <NotifyPastBuyersModal
        visible={!!notifyBuyersProduct}
        product={notifyBuyersProduct}
        onClose={() => setNotifyBuyersProduct(null)}
      />

      <BatchListModal
        visible={!!viewingBatchesProduct}
        product={viewingBatchesProduct}
        onClose={() => setViewingBatchesProduct(null)}
      />

      <UndoToast
        visible={!!pendingUndo}
        message={
          pendingUndo && pendingUndo.removedProducts.length === 1
            ? t("productDeletedMessage", {
                name: pendingUndo.removedProducts[0].name,
              })
            : t("productsDeletedMessage", {
                count: pendingUndo?.removedProducts.length || 0,
              })
        }
        onUndo={handleUndo}
      />
    </div>
  );
};

const styles = {
  floatingStack: {
    position: "fixed",
    left: 244,
    right: 28,
    bottom: 28,
    zIndex: 30,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    pointerEvents: "none",
  },
  wrap: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    maxWidth: 1080,
    margin: "0 auto",
    width: "100%",
  },
  addBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
  },
  posterBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
  pickerOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  pickerModal: {
    width: 360,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
  },
  pickerTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
  pickerLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "var(--text-primary)",
  },
  pickerSelect: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 20,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  pickerActions: { display: "flex", gap: 10 },
  pickerCancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  pickerContinueBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  selectionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "var(--primary-light)",
    borderRadius: 12,
    marginBottom: 14,
  },
  selectionCount: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--primary-dark)",
  },
  selectionLinkBtn: {
    background: "none",
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--primary-dark)",
  },
  selectionDeleteBtn: {
    padding: "8px 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--danger)",
    color: "white",
    fontWeight: 700,
    fontSize: 12,
  },
  emptyState: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 48,
    textAlign: "center",
  },
  sampleDataBtn: {
    padding: "10px 18px",
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  searchInput: {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 14,
    background: "var(--surface)",
    color: "var(--text-primary)",
  },
  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
    flexWrap: "wrap",
    alignItems: "center",
  },
  filterBtn: {
    padding: "8px 16px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  filterBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  expiryFilterChip: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1.5px solid var(--warning)",
    background: "var(--warning-light)",
    color: "var(--warning)",
    fontWeight: 700,
    fontSize: 12,
  },
  sortOrderBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },
};

export default ProductsScreen;


