import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { dataService } from "../services/DataService";
import { setCurrentActor } from "../services/ActivityLogService";
import translationsDict, { translate } from "../i18n/translations.js";
import TrialBanner from "./TrialBanner.jsx";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  CreditCard,
  Clock,
  Users,
  Wallet,
  Landmark,
  Truck,
  UserCog,
  History,
  Settings,
  BarChart3,
  FileText,
  LogOut,
  Languages,
} from "lucide-react";

// Which permission (if any) each nav item needs — mirrors App.jsx's
// SCREEN_PERMISSIONS map. A staff member without a given permission
// simply never sees that item; the owner sees everything unconditionally.
const NAV_PERMISSION = {
  products: "manageProducts",
  sales: "manageSales",
  credit: "manageCredit",
  customers: "manageCredit",
  expenses: "manageExpenses",
  reports: "manageExpenses",
  accounts: "manageExpenses",
  documents: "manageSales",
  suppliers: "manageSuppliers",
  staff: "manageStaff",
  activityLog: "manageStaff",
  settings: "manageSettings",
};

// Grouped by workflow rather than one flat list of twelve equal-weight
// items — the earlier version had every screen sitting at the same
// visual level with nothing to help the eye parse it quickly. A group
// only renders if at least one of its items is visible to the current
// user, so a staff member with narrow permissions doesn't see an empty
// section header.
const NAV_GROUPS = [
  {
    labelKey: null,
    items: [
      { key: "dashboard", labelKey: "navDashboard", Icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "navGroupSales",
    items: [
      { key: "sales", labelKey: "navSales", Icon: ShoppingCart },
      { key: "orders", labelKey: "navOrders", Icon: ClipboardList },
      { key: "credit", labelKey: "navCredit", Icon: CreditCard },
      { key: "receivablesAging", labelKey: "navReceivablesAging", Icon: Clock },
      { key: "customers", labelKey: "navCustomers", Icon: Users },
    ],
  },
  {
    labelKey: "navGroupInventory",
    items: [
      { key: "products", labelKey: "navProducts", Icon: Package },
      { key: "suppliers", labelKey: "navSuppliers", Icon: Truck },
    ],
  },
  {
    labelKey: "navGroupFinance",
    items: [{ key: "expenses", labelKey: "navExpenses", Icon: Wallet }, { key: "accounts", labelKey: "navAccounts", Icon: Landmark }, { key: "reports", labelKey: "navReports", Icon: BarChart3 }, { key: "documents", labelKey: "navDocuments", Icon: FileText }],
  },
  {
    labelKey: "navGroupAdmin",
    items: [
      { key: "staff", labelKey: "navStaff", Icon: UserCog },
      { key: "activityLog", labelKey: "navActivityLog", Icon: History },
      { key: "settings", labelKey: "navSettings", Icon: Settings },
    ],
  },
];

const Sidebar = ({
  activeScreen,
  onNavigate,
  businessName,
  settings,
  currentUser,
  onLogout,
  licenseStatus,
}) => {
  const { t, language, setLanguage } = useLanguage();

  const canSee = (item) => {
    const required = NAV_PERMISSION[item.key];
    if (!required) return true; // dashboard, always visible
    return currentUser?.isOwner || !!currentUser?.permissions?.[required];
  };

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(canSee),
  })).filter((group) => group.items.length > 0);

  const handleToggleLanguage = async () => {
    const next = language === "sw" ? "en" : "sw";
    try {
      const currentSettings = await dataService.getSettings();
      setLanguage(next, currentSettings);
      if (currentUser?.isOwner) {
        const nextDict = translationsDict[next] || translationsDict.sw;
        setCurrentActor(translate(nextDict, "ownerRoleLabel"));
      }
    } catch (err) {
      console.error("Toggle language error:", err);
    }
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>
            {(businessName || "HisaFlow").charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.brandName}>{businessName || "HisaFlow"}</div>
            {currentUser && (
              <div style={styles.userLine}>
                {currentUser.isOwner
                  ? t("ownerRoleLabel")
                  : `${currentUser.name} · ${t("staffRoleLabel")}`}
              </div>
            )}
          </div>
        </div>
        {licenseStatus && !licenseStatus.licensed && (
          <TrialBanner daysRemaining={licenseStatus.daysRemaining} />
        )}
      </div>

      <nav style={styles.nav}>
        {visibleGroups.map((group, gi) => (
          <div key={group.labelKey || "top"} style={styles.navGroup}>
            {group.labelKey && (
              <div style={styles.groupLabel}>{t(group.labelKey)}</div>
            )}
            {group.items.map((item) => {
              const active = activeScreen === item.key;
              return (
                <button
                  key={item.key}
                  className="hf-nav-item"
                  onClick={() => onNavigate(item.key)}
                  style={{
                    ...styles.navItem,
                    ...(active ? styles.navItemActive : {}),
                  }}
                >
                  <item.Icon
                    size={17}
                    strokeWidth={2}
                    color={active ? "var(--primary-dark)" : "var(--text-muted)"}
                    style={{ flexShrink: 0 }}
                  />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={styles.footer}>
        <button
          className="hf-nav-item"
          style={styles.footerBtn}
          onClick={handleToggleLanguage}
        >
          <Languages size={16} color="var(--text-muted)" />
          {language === "sw" ? "Kiswahili" : "English"}
        </button>
        <button
          className="hf-nav-item"
          style={styles.footerBtn}
          onClick={onLogout}
        >
          <LogOut size={16} color="var(--text-muted)" />
          {t("logout")}
        </button>
      </div>
    </div>
  );
};

const styles = {
  sidebar: {
    width: 220,
    background: "var(--surface)",
    borderRight: "1px solid var(--border-muted)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 0",
  },
  header: { padding: "0 16px", marginBottom: 18 },
  brandRow: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "var(--primary)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 800,
    flexShrink: 0,
  },
  brandName: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userLine: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  nav: { flex: 1, overflow: "auto", padding: "4px 8px" },
  navGroup: { marginBottom: 4 },
  groupLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    padding: "12px 10px 6px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left",
    width: "100%",
    padding: "8px 10px",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 600,
    transition: "background 0.15s ease, color 0.15s ease",
  },
  navItemActive: {
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
    fontWeight: 700,
  },
  footer: {
    padding: "8px 8px 0",
    borderTop: "1px solid var(--border-muted)",
    marginTop: 8,
  },
  footerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left",
    width: "100%",
    padding: "9px 10px",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 600,
  },
};

export default Sidebar;


