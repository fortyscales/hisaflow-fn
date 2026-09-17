import React, { useState, useEffect, useCallback, useRef } from "react";
import LoginScreen from "./screens/LoginScreen.jsx";
import TrialLockScreen from "./screens/TrialLockScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import ProductsScreen from "./screens/ProductsScreen.jsx";
import SalesScreen from "./screens/SalesScreen.jsx";
import OrdersScreen from "./screens/ordersScreen.jsx";
import CreditScreen from "./screens/CreditScreen.jsx";
import ReceivablesAgingScreen from "./screens/ReceivablesAgingScreen.jsx";
import CustomersScreen from "./screens/CustomersScreen.jsx";
import ExpensesScreen from "./screens/ExpensesScreen.jsx";
import SuppliersScreen from "./screens/SuppliersScreen.jsx";
import StaffScreen from "./screens/StaffScreen.jsx";
import ActivityLogScreen from "./screens/ActivityLogScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import ReportsScreen from "./screens/ReportsScreen.jsx";
import AccountsScreen from "./screens/AccountsScreen.jsx";
import DocumentsScreen from "./screens/DocumentsScreen.jsx";
import Sidebar from "./components/SideBar.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { RestockCartProvider } from "./context/RestockCartContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { dataService } from "./services/DataService";
import { backupService } from "./services/backupService";
import { setCurrentActor } from "./services/ActivityLogService";
import { crashLogService } from "./services/crashLogService";
import translationsDict, { translate } from "./i18n/translations.js";

// The owner's "name" is a hardcoded placeholder ("Owner"), not a real
// person's name - the app never actually collects one. Left as-is, it
// would show up in every sale/activity record as literal English
// forever, regardless of which language was active. Resolving it
// through translate() here means it's captured correctly in whatever
// language was active at the time, same as the product/brand snapshots
// already do for sales.
const resolveActorName = (identity, language) => {
  if (!identity) return null;
  if (identity.isOwner) {
    const dict = translationsDict[language] || translationsDict.sw;
    return translate(dict, "ownerRoleLabel");
  }
  return identity.name;
};

// Installed once, at true module load time — not inside the component or
// an effect — so it's active before anything else in the app has a
// chance to throw, including the very first render.
crashLogService.installGlobalHandlers();

// Which permission (if any) a screen requires — dashboard is always
// visible to anyone logged in, since it's just numbers, nothing
// destructive lives there.
const SCREEN_PERMISSIONS = {
  dashboard: null,
  products: "manageProducts",
  sales: "manageSales",
  orders: "manageSales",
  credit: "manageCredit",
  receivablesAging: "manageCredit",
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

const SESSION_KEY = "hisaflow_session";

// Keeps the current login session and active screen across a refresh —
// sessionStorage specifically, not localStorage: it survives a page
// reload (Vite HMR during dev, an accidental F5) but still clears the
// moment the actual app window closes. A refresh mid-session shouldn't
// force a PIN re-entry; a fresh app launch on a shared computer should.
const readSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSession = (settings, currentUser, activeScreen) => {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ settings, currentUser, activeScreen }),
    );
  } catch {
    // sessionStorage can fail in rare cases (quota, privacy mode) —
    // losing the persisted session isn't worth crashing over.
  }
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
};

const App = () => {
  const existingSession = readSession();
  const [settings, setSettings] = useState(existingSession?.settings || null);
  const [currentUser, setCurrentUser] = useState(
    existingSession?.currentUser || null,
  );
  const [activeScreen, setActiveScreen] = useState(
    existingSession?.activeScreen || "dashboard",
  );
  const [initialLanguage, setInitialLanguage] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const backupPendingRef = useRef(false);

  useEffect(() => {
    if (existingSession?.currentUser)
      setCurrentActor(
        resolveActorName(
          existingSession.currentUser,
          existingSession.settings?.language,
        ),
      );
    // Read once up front so the correct language is active from the very
    // first screen (including the PIN login), not just after unlocking.
    dataService
      .getSettings()
      .then((s) => setInitialLanguage(s.language || "sw"));
    // Checked before anything else — a trial lock has to block the login
    // screen too, not just the screens behind it.
    dataService.getLicenseStatus().then(setLicenseStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the persisted session in sync whenever login state or the
  // active screen changes, so a refresh always lands back where it left off.
  useEffect(() => {
    if (settings) writeSession(settings, currentUser, activeScreen);
  }, [settings, currentUser, activeScreen]);

  const performAutoBackup = useCallback(async () => {
    const current = await dataService.getSettings();
    if (!current.ownerPhone || !current.ownerPin) return; // nothing to protect recovery with yet

    const result = await backupService.pushToCloud(
      current.ownerPhone,
      current.ownerPin,
    );
    backupPendingRef.current = !result.success;
    if (result.success) {
      await dataService.saveSettings({
        ...current,
        lastCloudBackupAt: new Date().toISOString(),
      });
    }
  }, []);

  // Same layered approach as the phone app: a steady interval as a
  // fallback, plus firing the moment connectivity actually returns (most
  // "failures" aren't real failures, just being offline at that instant),
  // plus one last attempt right before the window closes.
  useEffect(() => {
    if (!settings) return;

    const interval = setInterval(performAutoBackup, 30 * 60 * 1000);

    const handleOnline = () => {
      if (backupPendingRef.current) performAutoBackup();
    };
    window.addEventListener("online", handleOnline);

    const handleBeforeUnload = () => {
      performAutoBackup();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [settings, performAutoBackup]);

  const handleUnlock = (loadedSettings, identity) => {
    setSettings(loadedSettings);
    setCurrentUser(identity);
    setCurrentActor(resolveActorName(identity, loadedSettings?.language));
    setActiveScreen("dashboard");
  };

  const handleLogout = () => {
    setSettings(null);
    setCurrentUser(null);
    setCurrentActor(null);
    setActiveScreen("dashboard");
    clearSession();
  };

  const [navigationParams, setNavigationParams] = useState(null);

  const handleNavigate = (screenKey, params = null) => {
    const required = SCREEN_PERMISSIONS[screenKey];
    if (
      required &&
      !currentUser?.isOwner &&
      !currentUser?.permissions?.[required]
    )
      return; // silently ignore, nav shouldn't have shown this anyway
    setNavigationParams(params);
    setActiveScreen(screenKey);
  };

  const canAccess = (screenKey) => {
    const required = SCREEN_PERMISSIONS[screenKey];
    if (!required) return true;
    return currentUser?.isOwner || !!currentUser?.permissions?.[required];
  };

  if (initialLanguage === null || licenseStatus === null) return null; // brief, avoids a language/lock flash

  if (licenseStatus.trialExpired) {
    return (
      <LanguageProvider initialLanguage={initialLanguage}>
        <TrialLockScreen
          machineId={licenseStatus.machineId}
          onActivated={() =>
            dataService.getLicenseStatus().then(setLicenseStatus)
          }
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      {!settings ? (
        <LoginScreen onUnlock={handleUnlock} />
      ) : (
        <CartProvider>
          <RestockCartProvider>
            <div
              style={{
                height: "100vh",
                display: "flex",
                background: "var(--bg)",
              }}
            >
              <Sidebar
                activeScreen={activeScreen}
                onNavigate={handleNavigate}
                businessName={settings.businessName}
                settings={settings}
                currentUser={currentUser}
                onLogout={handleLogout}
                licenseStatus={licenseStatus}
              />
              <div
                key={activeScreen}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  animation: "screenFadeIn 0.18s ease",
                }}
              >
                {activeScreen === "dashboard" && (
                  <DashboardScreen
                    onNavigate={handleNavigate}
                    currentUser={currentUser}
                  />
                )}
                {activeScreen === "products" && canAccess("products") && (
                  <ProductsScreen initialFilter={navigationParams} />
                )}
                {activeScreen === "sales" && canAccess("sales") && (
                  <SalesScreen currentUser={currentUser} />
                )}
                {activeScreen === "orders" && canAccess("orders") && (
                  <OrdersScreen
                    currentUser={currentUser}
                    onNavigate={handleNavigate}
                  />
                )}
                {activeScreen === "credit" && canAccess("credit") && (
                  <CreditScreen />
                )}
                {activeScreen === "receivablesAging" &&
                  canAccess("receivablesAging") && <ReceivablesAgingScreen />}
                {activeScreen === "customers" && canAccess("customers") && (
                  <CustomersScreen />
                )}
                {activeScreen === "expenses" && canAccess("expenses") && (
                  <ExpensesScreen />
                )}
                {activeScreen === "reports" && canAccess("reports") && (
                  <ReportsScreen />
                )}
                {activeScreen === "accounts" && canAccess("accounts") && (
                  <AccountsScreen />
                )}
                {activeScreen === "documents" && canAccess("documents") && (
                  <DocumentsScreen />
                )}
                {activeScreen === "suppliers" && canAccess("suppliers") && (
                  <SuppliersScreen />
                )}
                {activeScreen === "staff" && canAccess("staff") && (
                  <StaffScreen />
                )}
                {activeScreen === "activityLog" && canAccess("activityLog") && (
                  <ActivityLogScreen />
                )}
                {activeScreen === "settings" && canAccess("settings") && (
                  <SettingsScreen />
                )}
              </div>
            </div>
          </RestockCartProvider>
        </CartProvider>
      )}
    </LanguageProvider>
  );
};

export default App;


