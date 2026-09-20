import React, { useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { alertService } from "../services/alertService";
import { notificationService } from "../services/notificationService";
import { productService } from "../services/productService";
import { orderService } from "../services/orderService";
import ReportModal from "../components/ReportModal.jsx";
import WeeklyRecapModal from "../components/WeeklyRecapModal.jsx";
import StockAlertBanner from "../components/StockAlertBanner.jsx";
import ExpiryAlertBanner from "../components/ExpiryAlertBanner.jsx";
import OverdueReceivablesBanner from "../components/OverdueReceivablesBanner.jsx";
import PendingOrdersBanner from "../components/PendingOrdersBanner.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import LoadingState from "../components/LoadingState.jsx";
import SaleFormModal from "../components/SaleFormModal.jsx";
import ReceiptModal from "../components/ReceiptModal.jsx";
import ProductFormModal from "../components/ProductFormModal.jsx";
import CreateOrderModal from "../components/CreateOrderModal.jsx";
import OrderTicketModal from "../components/OrderTicketModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  LayoutDashboard,
  ShoppingCart,
  PackagePlus,
  ClipboardList,
} from "lucide-react";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const PERIODS = ["today", "week", "month", "quarter", "year", "all"];

const DashboardScreen = ({ onNavigate, currentUser }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    transactionCount: 0,
    bestSellers: [],
    mostProfitable: [],
    maxSellerQty: 1,
    maxProfitAmount: 1,
  });
  const [overdueSummary, setOverdueSummary] = useState({
    customerCount: 0,
    overdueTotal: 0,
  });
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [period, setPeriod] = useState("today");

  // Quick-action state - lets an owner record a sale, add a product, or
  // write up an order without leaving the dashboard at all. Each one
  // reuses the exact same modal and completion flow as its dedicated
  // screen (SaleFormModal + ReceiptModal, productService.saveProduct,
  // CreateOrderModal + OrderTicketModal), so nothing behaves differently
  // just because it was triggered from here.
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [quickSaleReceipt, setQuickSaleReceipt] = useState(null);
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [quickOrderTicket, setQuickOrderTicket] = useState(null);

  const getPeriodRange = (selectedPeriod) => {
    if (selectedPeriod === "all") return { start: null, end: null };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (selectedPeriod === "week")
      start.setDate(start.getDate() - start.getDay());
    else if (selectedPeriod === "month") start.setDate(1);
    else if (selectedPeriod === "quarter")
      start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
    else if (selectedPeriod === "year") start.setMonth(0, 1);
    return { start: start.toISOString(), end: null };
  };

  const loadAnalytics = async (selectedPeriod = period) => {
    const range = getPeriodRange(selectedPeriod);
    const result = await dataService.getDashboardAnalytics({
      ...range,
      isOwner: !currentUser || currentUser.isOwner,
      actorName: currentUser?.name || null,
      limit: 5,
    });
    setAnalytics(result);
  };

  const loadAll = () => {
    const overdueCutoff = new Date();
    overdueCutoff.setDate(overdueCutoff.getDate() - 60);
    return Promise.all([
      dataService.getProducts(),
      dataService.getSettings(),
      orderService.getOrders(),
      dataService.getOverdueReceivablesSummary({
        cutoff: overdueCutoff.toISOString(),
      }),
      loadAnalytics(period),
    ]).then(([p, set, o, overdue]) => {
      setProducts(p);
      setSettings(set);
      setOrders(o);
      setOverdueSummary({
        customerCount: overdue.customer_count || 0,
        overdueTotal: overdue.overdue_total || 0,
      });

      const stockAlerts = alertService.getLowStockAlerts(p);
      const expiryAlerts = alertService.getExpiryAlerts(p);
      const totalAlerts = stockAlerts.total + expiryAlerts.total;
      if (totalAlerts > 0) {
        notificationService.showOnceThisSession(
          t("stockAlertTitle"),
          t("alertNotificationBody", { count: totalAlerts }),
        );
      }
    });
  };

  useEffect(() => {
    loadAll().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) loadAnalytics(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleQuickSaleCompleted = (saleData) => {
    loadAll();
    setShowQuickSale(false);
    setQuickSaleReceipt(saleData);
  };

  const handleQuickProductSave = async ({
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
    setShowQuickProduct(false);
  };

  const handleQuickCreateOrder = async (payload) => {
    const result = await orderService.createOrder(payload);
    if (result.success) {
      const fresh = await orderService.getOrders();
      setOrders(fresh);
      const created = fresh.find((o) => o.id === result.order.id);
      setShowQuickOrder(false);
      if (created) setQuickOrderTicket(created);
    }
    return result;
  };

  const periodLabel = (p) => {
    if (p === "today") return t("periodToday");
    if (p === "week") return t("periodThisWeek");
    if (p === "month") return t("periodThisMonth");
    if (p === "quarter") return t("periodThisQuarter");
    if (p === "year") return t("periodThisYear");
    return t("periodAllTime");
  };

  const isOwner = !currentUser || currentUser.isOwner;
  const hasPermission = (perm) =>
    !currentUser || currentUser.isOwner || !!currentUser.permissions?.[perm];

  // Financial and ranking calculations are performed by SQLite, not by
  // loading the entire sales/credit/expense history into the renderer.
  const {
    totalRevenue = 0,
    totalExpenses = 0,
    netProfit = 0,
    transactionCount = 0,
    bestSellers = [],
    mostProfitable = [],
    maxSellerQty = 1,
    maxProfitAmount = 1,
  } = analytics;

  const quickActions = [
    hasPermission("manageSales") && {
      key: "sale",
      Icon: ShoppingCart,
      label: t("quickActionRecordSale"),
      onClick: () => setShowQuickSale(true),
    },
    hasPermission("manageProducts") && {
      key: "product",
      Icon: PackagePlus,
      label: t("quickActionAddProduct"),
      onClick: () => setShowQuickProduct(true),
    },
    hasPermission("manageSales") && {
      key: "order",
      Icon: ClipboardList,
      label: t("quickActionCreateOrder"),
      onClick: () => setShowQuickOrder(true),
    },
  ].filter(Boolean);

  if (loading) return <LoadingState />;

  return (
    <div style={styles.wrap}>
      <ScreenHeader
        Icon={LayoutDashboard}
        title={t("greetingHi", {
          name: currentUser?.isOwner
            ? t("ownerRoleLabel")
            : currentUser?.name || "",
        })}
        subtitle={t("greetingSubtitle")}
      >
        {isOwner && (
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.recapBtn} onClick={() => setShowRecap(true)}>
              {t("weeklyRecapButton")}
            </button>
            <button
              style={styles.exportBtn}
              onClick={() => setShowReport(true)}
            >
              {t("generateReportButton")}
            </button>
          </div>
        )}
      </ScreenHeader>

      {onNavigate && (
        <div style={styles.bannerStack}>
          <StockAlertBanner
            products={products}
            onPress={() => onNavigate("products")}
          />
          <ExpiryAlertBanner
            products={products}
            onPress={() => onNavigate("products", { expiryFilter: "expired" })}
          />
          <OverdueReceivablesBanner
            summary={overdueSummary}
            onPress={() => onNavigate("receivablesAging")}
          />
          <PendingOrdersBanner
            orders={orders}
            onPress={() => onNavigate("orders")}
          />
        </div>
      )}

      {/* The actual point of this rebuild - three things an owner needs
          to do constantly, done right here without leaving the page. */}
      {quickActions.length > 0 && (
        <div style={styles.quickActionsRow}>
          {quickActions.map((qa) => (
            <button
              key={qa.key}
              style={styles.quickActionCard}
              onClick={qa.onClick}
            >
              <span style={styles.quickActionIcon}>
                <qa.Icon size={20} color="var(--primary-dark)" />
              </span>
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {products.length === 0 && transactionCount === 0 && (
        <div style={styles.emptyNote}>{t("noDataYet")}</div>
      )}
      <div style={styles.periodRow}>
        {PERIODS.map((p) => (
          <button
            key={p}
            style={{
              ...styles.periodBtn,
              ...(period === p ? styles.periodBtnActive : {}),
            }}
            onClick={() => setPeriod(p)}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("statProducts")}</div>
          <div style={styles.statValue}>{products.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            {isOwner ? t("statSales") : t("statMySales")}
          </div>
          <div style={styles.statValue}>{transactionCount}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            {isOwner ? t("statRevenue") : t("statMyRevenue")}
          </div>
          <div style={{ ...styles.statValue, color: "var(--primary-dark)" }}>
            {formatTZS(totalRevenue)}
          </div>
        </div>
        {isOwner && (
          <div style={styles.statCard}>
            <div style={styles.statLabel}>{t("statExpenses")}</div>
            <div style={{ ...styles.statValue, color: "var(--danger)" }}>
              {formatTZS(totalExpenses)}
            </div>
          </div>
        )}
        {isOwner && (
          <div style={styles.statCard}>
            <div style={styles.statLabel}>{t("statNetProfit")}</div>
            <div
              style={{
                ...styles.statValue,
                color: netProfit >= 0 ? "var(--primary-dark)" : "var(--danger)",
              }}
            >
              {formatTZS(netProfit)}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          ...styles.rankingsRow,
          gridTemplateColumns: isOwner ? "1fr 1fr" : "1fr",
        }}
      >
        <div style={styles.rankingCard}>
          <h2 style={styles.rankingTitle}>{t("bestSellersHeading")}</h2>
          {bestSellers.length === 0 ? (
            <div style={styles.rankingEmpty}>{t("noSalesInPeriodMessage")}</div>
          ) : (
            bestSellers.map(({ product, quantity }) => (
              <div key={product.id} style={styles.rankRow}>
                <div style={styles.rankInfo}>
                  <span style={styles.rankName}>{product.name}</span>
                  <span style={styles.rankValue}>
                    {quantity} {product.unit}
                  </span>
                </div>
                <div style={styles.rankBarTrack}>
                  <div
                    style={{
                      ...styles.rankBarFill,
                      width: `${(quantity / maxSellerQty) * 100}%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {isOwner && (
          <div style={styles.rankingCard}>
            <h2 style={styles.rankingTitle}>{t("mostProfitableHeading")}</h2>
            {mostProfitable.length === 0 ? (
              <div style={styles.rankingEmpty}>
                {t("noSalesInPeriodMessage")}
              </div>
            ) : (
              mostProfitable.map(({ product, profit }) => (
                <div key={product.id} style={styles.rankRow}>
                  <div style={styles.rankInfo}>
                    <span style={styles.rankName}>{product.name}</span>
                    <span style={styles.rankValue}>{formatTZS(profit)}</span>
                  </div>
                  <div style={styles.rankBarTrack}>
                    <div
                      style={{
                        ...styles.rankBarFill,
                        width: `${(profit / maxProfitAmount) * 100}%`,
                        background: "var(--primary-dark)",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ReportModal visible={showReport} onClose={() => setShowReport(false)} />
      <WeeklyRecapModal
        visible={showRecap}
        onClose={() => setShowRecap(false)}
      />

      <SaleFormModal
        visible={showQuickSale}
        products={products}
        onCompleted={handleQuickSaleCompleted}
        onClose={() => setShowQuickSale(false)}
      />
      <ReceiptModal
        visible={!!quickSaleReceipt}
        sale={quickSaleReceipt}
        settings={settings}
        onClose={() => setQuickSaleReceipt(null)}
      />

      <ProductFormModal
        visible={showQuickProduct}
        editingProduct={null}
        onSave={handleQuickProductSave}
        onClose={() => setShowQuickProduct(false)}
      />

      <CreateOrderModal
        visible={showQuickOrder}
        products={products}
        currentUser={currentUser}
        onCreate={handleQuickCreateOrder}
        onClose={() => setShowQuickOrder(false)}
      />
      <OrderTicketModal
        visible={!!quickOrderTicket}
        order={quickOrderTicket}
        settings={settings}
        onClose={() => setQuickOrderTicket(null)}
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
  recapBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  exportBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  bannerStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 18,
  },
  quickActionsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
    marginBottom: 22,
  },
  quickActionCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 18px",
    borderRadius: 16,
    border: "1.5px solid var(--primary)",
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
    fontWeight: 800,
    fontSize: 14,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyNote: {
    background: "var(--accent-light)",
    color: "#8A5A1E",
    fontSize: 13,
    fontWeight: 600,
    padding: "14px 18px",
    borderRadius: 14,
    marginBottom: 24,
  },
  periodRow: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  periodBtn: {
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
  periodBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 20,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 6,
  },
  statValue: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" },
  rankingsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  rankingCard: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 20,
  },
  rankingTitle: { fontSize: 14, fontWeight: 800, marginBottom: 14 },
  rankingEmpty: { fontSize: 12, color: "var(--text-muted)", padding: "10px 0" },
  rankRow: { marginBottom: 12 },
  rankInfo: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  rankName: { fontSize: 12, fontWeight: 700, color: "var(--text-primary)" },
  rankValue: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" },
  rankBarTrack: {
    height: 6,
    background: "var(--border-muted)",
    borderRadius: 999,
    overflow: "hidden",
  },
  rankBarFill: { height: "100%", borderRadius: 999 },
};

export default DashboardScreen;
