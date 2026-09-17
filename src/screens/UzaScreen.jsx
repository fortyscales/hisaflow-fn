import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useCart } from "../context/CartContext.jsx";
import ReceiptModal from "../components/ReceiptModal.jsx";
import { dataService } from "../services/DataService";
import { salesService } from "../services/salesService";
import { creditService } from "../services/creditService";
import { useLanguage } from "../context/LanguageContext.jsx";

// Same threshold alertService already uses everywhere else in the app
// (SyncService's low-stock count, the stock alert banner) - matched
// here deliberately rather than inventing a second definition of "low."
const LOW_STOCK_THRESHOLD = 10;

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cashMethodOption" },
  { value: "lipa_namba", labelKey: "lipaNambaMethodOption" },
  { value: "bank_transfer", labelKey: "bankTransferMethodOption" },
];

// A dedicated point-of-sale screen — product grid with a persistent
// cart panel, distinct from the Sales screen's transaction history.
// Uses the same CartContext, salesService.completeCartSale, and
// creditService.completeCreditSale that CartModal already relies on -
// the checkout logic itself is untouched, only laid out differently.
const UzaScreen = () => {
  const { t } = useLanguage();
  const {
    items,
    addToCart,
    updateQuantity,
    updateDiscount,
    removeFromCart,
    clearCart,
    totalAmount,
    activeOrderId,
  } = useCart();

  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [receiptSale, setReceiptSale] = useState(null);
  const [topSellingIds, setTopSellingIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [receivedVia, setReceivedVia] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    dataService.getProducts().then(setProducts);
    dataService.getSettings().then((s) => {
      setSettings(s);
      setPaymentAccounts(s.paymentAccounts || []);
    });
    dataService
      .getTopSellingProductIds(10)
      .then(setTopSellingIds)
      .catch(() => setTopSellingIds([]));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(
      products.map((p) => p.category).filter((c) => c && c.trim()),
    );
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== "all" && p.category !== activeCategory)
        return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCategory, searchQuery]);

  const topSellingProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return topSellingIds
      .map((id) => byId.get(id))
      .filter((p) => p && (p.stock || 0) > 0);
  }, [topSellingIds, products]);

  const handleAdd = useCallback(
    (product) => {
      if ((product.stock || 0) <= 0) return;
      addToCart(product);
    },
    [addToCart],
  );

  const totalItemsCount = items.length;
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const discountAmount =
    paymentMode === "cash"
      ? (totalAmount * (parseFloat(discountPct) || 0)) / 100
      : 0;
  const grandTotal = totalAmount - discountAmount;

  const handleCheckout = useCallback(async () => {
    if (completing) return;
    if (items.length === 0) {
      setError(t("cartEmpty"));
      return;
    }
    setError("");
    setCompleting(true);
    try {
      const selectedAccount = paymentAccounts.find((a) => a.id === receivedVia);
      const paymentMethod =
        paymentMode === "cash"
          ? selectedAccount
            ? selectedAccount.type
            : receivedVia
          : "";
      const accountId =
        paymentMode === "cash" ? selectedAccount?.id || null : null;
      const accountLabel =
        paymentMode === "cash" ? selectedAccount?.label || "" : "";
      const accountNumber =
        paymentMode === "cash" ? selectedAccount?.accountNumber || "" : "";

      // Discount here is a percentage applied to the whole cart, spread
      // proportionally across items by value - individual per-item
      // discounts (as CartModal supports) aren't part of this screen's
      // simpler flow, matching the mockup's single cart-level field.
      const itemsWithDiscount =
        discountAmount > 0
          ? items.map((item) => ({
              ...item,
              discount:
                totalAmount > 0
                  ? Math.round(
                      (item.sellingPrice * item.quantity * discountAmount) /
                        totalAmount,
                    )
                  : 0,
            }))
          : items;

      const result =
        paymentMode === "credit"
          ? await creditService.completeCreditSale({
              cartItems: itemsWithDiscount,
              customerName,
              customerPhone,
              orderId: activeOrderId,
            })
          : await salesService.completeCartSale(itemsWithDiscount, {
              paymentMethod,
              accountId,
              accountLabel,
              accountNumber,
              orderId: activeOrderId,
            });

      if (!result.success) {
        setError(result.error || t("saleFailedError"));
        return;
      }

      const saleData = {
        items: itemsWithDiscount.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          discount: item.discount || 0,
        })),
        total: grandTotal,
        isCredit: paymentMode === "credit",
        paymentMethod,
        accountLabel,
        accountNumber,
        customerName,
        customerPhone,
        date: new Date().toISOString(),
      };

      clearCart();
      setCustomerName("");
      setCustomerPhone("");
      setDiscountPct("");
      setPaymentMode("cash");
      dataService.getProducts().then(setProducts); // refresh stock counts
      setReceiptSale(saleData);
    } catch (err) {
      console.error("Checkout error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setCompleting(false);
    }
  }, [
    completing,
    items,
    paymentMode,
    paymentAccounts,
    receivedVia,
    customerName,
    customerPhone,
    discountAmount,
    totalAmount,
    grandTotal,
    activeOrderId,
    clearCart,
    t,
  ]);

  // F9 completes the sale, matching the shortcut hint shown on the
  // button itself - rebinds each render so it always sees current cart
  // state rather than a stale closure from first mount.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "F9") {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCheckout]);

  return (
    <div style={styles.wrap}>
      <div style={styles.mainCol}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>{t("uzaScreenTitle")}</h1>
            <div style={styles.subtitle}>{t("uzaScreenSubtitle")}</div>
          </div>
        </div>

        <input
          style={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchProductPlaceholder")}
        />

        <div style={styles.categoryRow}>
          <button
            style={{
              ...styles.categoryChip,
              ...(activeCategory === "all" ? styles.categoryChipActive : {}),
            }}
            onClick={() => setActiveCategory("all")}
          >
            {t("allCategoriesChip")}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              style={{
                ...styles.categoryChip,
                ...(activeCategory === c ? styles.categoryChipActive : {}),
              }}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={styles.productGrid}>
          {filteredProducts.map((p) => {
            const isLow = (p.stock || 0) > 0 && p.stock <= LOW_STOCK_THRESHOLD;
            const isOut = (p.stock || 0) <= 0;
            return (
              <div key={p.id} style={styles.productCard}>
                <div style={styles.productCardName}>
                  {p.name}
                  {p.size && (
                    <span style={styles.productCardSize}> · {p.size}</span>
                  )}
                </div>
                <div style={styles.productCardPrice}>
                  {formatTZS(p.sellingPrice)}
                </div>
                <div style={styles.productCardFooter}>
                  <span
                    style={{
                      ...styles.stockBadge,
                      ...(isLow ? styles.stockBadgeLow : {}),
                      ...(isOut ? styles.stockBadgeOut : {}),
                    }}
                  >
                    {isOut
                      ? t("outOfStockBadge")
                      : `${p.stock} ${t("remainingSuffix")}`}
                  </span>
                  <button
                    style={{
                      ...styles.addBtn,
                      ...(isOut ? styles.addBtnDisabled : {}),
                    }}
                    disabled={isOut}
                    onClick={() => handleAdd(p)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {topSellingProducts.length > 0 && !searchQuery.trim() && (
          <>
            <div style={styles.sectionLabel}>{t("topSellingLabel")}</div>
            <div style={styles.topSellingRow}>
              {topSellingProducts.map((p) => (
                <button
                  key={p.id}
                  style={styles.topSellingTile}
                  onClick={() => handleAdd(p)}
                >
                  <div style={styles.topSellingName}>
                    {p.name}
                    {p.size && (
                      <span style={styles.productCardSize}> · {p.size}</span>
                    )}
                  </div>
                  <div style={styles.topSellingPrice}>
                    {formatTZS(p.sellingPrice)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={styles.cartCol}>
        <div style={styles.cartHeader}>
          <span style={styles.cartTitle}>{t("cartTitle")}</span>
          <span style={styles.cartCountBadge}>
            {t("itemsCountBadge", { count: totalItemsCount })}
          </span>
          {items.length > 0 && (
            <button style={styles.clearLink} onClick={clearCart}>
              {t("clearCartLink")}
            </button>
          )}
        </div>

        <div style={styles.cartList}>
          {items.length === 0 ? (
            <div style={styles.cartEmpty}>{t("cartEmptyHint")}</div>
          ) : (
            items.map((item) => (
              <div key={item.productId} style={styles.cartItem}>
                <div style={{ flex: 1 }}>
                  <div style={styles.cartItemName}>{item.productName}</div>
                  <div style={styles.cartItemPrice}>
                    {formatTZS(item.sellingPrice)}
                  </div>
                </div>
                <button
                  style={styles.qtyBtn}
                  onClick={() =>
                    updateQuantity(item.productId, item.quantity - 1)
                  }
                >
                  −
                </button>
                <span style={styles.qtyValue}>{item.quantity}</span>
                <button
                  style={styles.qtyBtn}
                  onClick={() =>
                    updateQuantity(item.productId, item.quantity + 1)
                  }
                >
                  +
                </button>
                <div style={styles.cartItemTotal}>
                  {formatTZS(item.sellingPrice * item.quantity)}
                </div>
                <button
                  style={styles.removeBtn}
                  onClick={() => removeFromCart(item.productId)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div style={styles.summaryRow}>
          <span>{t("itemCountLabel")}</span>
          <span>{totalItemsCount}</span>
        </div>
        <div style={styles.summaryRow}>
          <span>{t("unitCountLabel")}</span>
          <span>{totalUnits}</span>
        </div>
        <div style={styles.summaryRow}>
          <span>{t("subtotalLabel")}</span>
          <span>{formatTZS(totalAmount)}</span>
        </div>

        {paymentMode === "cash" && (
          <div style={styles.discountRow}>
            <input
              style={styles.discountInput}
              type="number"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              placeholder={t("discountPercentPlaceholder")}
            />
          </div>
        )}

        <div style={styles.grandTotalBox}>
          <span style={styles.grandTotalLabel}>{t("grandTotalLabel")}</span>
          <span style={styles.grandTotalValue}>{formatTZS(grandTotal)}</span>
        </div>

        <div style={styles.modeRow}>
          <button
            style={{
              ...styles.modeBtn,
              ...(paymentMode === "cash" ? styles.modeBtnActive : {}),
            }}
            onClick={() => setPaymentMode("cash")}
          >
            {t("cashSaleLabel")}
          </button>
          <button
            style={{
              ...styles.modeBtn,
              ...(paymentMode === "credit" ? styles.modeBtnActiveCredit : {}),
            }}
            onClick={() => setPaymentMode("credit")}
          >
            {t("creditSaleLabel")}
          </button>
        </div>

        {paymentMode === "cash" ? (
          <div style={styles.accountChipRow}>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                style={{
                  ...styles.accountChip,
                  ...(receivedVia === m.value ? styles.accountChipActive : {}),
                }}
                onClick={() => setReceivedVia(m.value)}
              >
                {t(m.labelKey)}
              </button>
            ))}
            {paymentAccounts.map((acc) => (
              <button
                key={acc.id}
                style={{
                  ...styles.accountChip,
                  ...(receivedVia === acc.id ? styles.accountChipActive : {}),
                }}
                onClick={() => setReceivedVia(acc.id)}
              >
                {acc.label}
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.customerFields}>
            <input
              style={styles.input}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t("customerNamePlaceholder")}
            />
            <input
              style={styles.input}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t("customerPhonePlaceholder")}
            />
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{
            ...styles.checkoutBtn,
            ...(paymentMode === "credit" ? styles.checkoutBtnCredit : {}),
          }}
          disabled={completing || items.length === 0}
          onClick={handleCheckout}
        >
          <span>
            {completing
              ? t("completing")
              : paymentMode === "credit"
                ? t("completeCreditSaleButton")
                : t("completeSaleButton")}
          </span>
          <span style={styles.shortcutHint}>F9</span>
        </button>
      </div>

      <ReceiptModal
        visible={!!receiptSale}
        sale={receiptSale}
        settings={settings}
        onClose={() => setReceiptSale(null)}
      />
    </div>
  );
};

const styles = {
  wrap: { display: "flex", gap: 20, height: "100%" },
  mainCol: { flex: 2, overflow: "auto", paddingRight: 4 },
  cartCol: {
    flex: 1,
    minWidth: 320,
    maxWidth: 380,
    background: "var(--surface)",
    borderRadius: 18,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    height: "fit-content",
    position: "sticky",
    top: 0,
  },
  header: { marginBottom: 16, position: "sticky", top: -28, zIndex: 20, marginTop: -28, marginLeft: -28, marginRight: -28, padding: "28px 28px 12px", background: "var(--bg)", borderBottom: "1px solid var(--border-muted)" },
  title: { fontSize: 20, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 13, color: "var(--text-muted)", marginTop: 2 },
  searchInput: {
    width: "100%",
    padding: "13px 15px",
    border: "1.5px solid var(--border)",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 14,
    background: "var(--surface)",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  },
  categoryRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    padding: "8px 16px",
    borderRadius: 999,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  categoryChipActive: {
    background: "var(--primary)",
    borderColor: "var(--primary)",
    color: "white",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 20,
  },
  productCard: {
    background: "var(--surface)",
    borderRadius: 14,
    padding: 14,
    border: "1.5px solid var(--border)",
  },
  productCardName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    minHeight: 34,
  },
  productCardSize: {
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  productCardPrice: {
    fontSize: 15,
    fontWeight: 800,
    color: "var(--primary-dark)",
    marginBottom: 10,
  },
  productCardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stockBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
  },
  stockBadgeLow: { color: "var(--warning, #b4732b)" },
  stockBadgeOut: { color: "var(--danger, #a8402f)" },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontSize: 16,
    fontWeight: 700,
    lineHeight: "30px",
    padding: 0,
  },
  addBtnDisabled: { background: "var(--border)", color: "var(--text-muted)" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  topSellingRow: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 8,
  },
  topSellingTile: {
    flexShrink: 0,
    minWidth: 120,
    padding: 12,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    textAlign: "left",
  },
  topSellingName: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  topSellingPrice: {
    fontSize: 12,
    fontWeight: 800,
    color: "var(--primary-dark)",
  },
  cartHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cartTitle: { fontSize: 16, fontWeight: 800, flex: 1 },
  cartCountBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--primary-dark)",
    background: "var(--primary-light)",
    padding: "3px 9px",
    borderRadius: 999,
  },
  clearLink: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--danger, #a8402f)",
    background: "none",
    border: "none",
  },
  cartList: { maxHeight: 320, overflow: "auto", marginBottom: 14 },
  cartEmpty: {
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "24px 0",
  },
  cartItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  cartItemName: { fontSize: 12, fontWeight: 700 },
  cartItemPrice: { fontSize: 11, color: "var(--text-muted)" },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    background: "var(--bg)",
    fontSize: 14,
    fontWeight: 700,
    padding: 0,
  },
  qtyValue: {
    fontSize: 12,
    fontWeight: 700,
    minWidth: 16,
    textAlign: "center",
  },
  cartItemTotal: {
    fontSize: 12,
    fontWeight: 800,
    minWidth: 64,
    textAlign: "right",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: 16,
    padding: "0 2px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "var(--text-secondary)",
    marginBottom: 6,
  },
  discountRow: { marginTop: 8, marginBottom: 4 },
  discountInput: {
    width: "100%",
    padding: "9px 11px",
    border: "1.5px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    boxSizing: "border-box",
  },
  grandTotalBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--primary-light)",
    borderRadius: 14,
    padding: "12px 16px",
    margin: "12px 0",
  },
  grandTotalLabel: { fontSize: 13, fontWeight: 700 },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--primary-dark)",
  },
  modeRow: { display: "flex", gap: 8, marginBottom: 10 },
  modeBtn: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  modeBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  modeBtnActiveCredit: {
    background: "var(--accent-light, #fbf0e2)",
    borderColor: "var(--accent, #b4732b)",
    color: "#8A5A1E",
  },
  accountChipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  accountChip: {
    padding: "7px 12px",
    borderRadius: 999,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 11,
  },
  accountChipActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  customerFields: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    padding: "9px 11px",
    border: "1.5px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    boxSizing: "border-box",
  },
  error: {
    background: "var(--danger-light, #fbe9e5)",
    color: "var(--danger, #a8402f)",
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 12px",
    borderRadius: 10,
    marginBottom: 10,
  },
  checkoutBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  checkoutBtnCredit: { background: "#8A5A1E" },
  shortcutHint: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.7,
    border: "1px solid rgba(255,255,255,0.5)",
    borderRadius: 4,
    padding: "1px 5px",
  },
};

export default UzaScreen;


