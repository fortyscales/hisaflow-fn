import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import { customerService } from "../services/customerService";
import { creditService } from "../services/creditService";
import CustomerCard from "../components/CustomerCard.jsx";
import CustomerProfileModal from "../components/CustomerProfilemodal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import StickyScreenChrome from "../components/StickyScreenChrome.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { Users } from "lucide-react";

const CustomersScreen = () => {
  const { t } = useLanguage();
  const [creditSales, setCreditSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [openCustomerKey, setOpenCustomerKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadCreditSales = () =>
    dataService.getCreditSales().then((data) => {
      setCreditSales(data);
      setLoading(false);
    });

  useEffect(() => {
    loadCreditSales();
    dataService.getSettings().then(setSettings);
  }, []);

  const handleRecordPayment = async (creditSaleId, amount, paymentMethod, account) => {
    const result = await creditService.recordPayment(
      creditSaleId,
      amount,
      paymentMethod,
      account,
    );
    if (result.success) await loadCreditSales();
    return result;
  };

  // Aggregating every credit sale into per-customer profiles is real work
  // once there's meaningful transaction history — memoized so it only
  // recomputes when the underlying credit sales actually change, not on
  // every render (e.g. just opening a customer's profile modal).
  const customers = useMemo(
    () => customerService.getCustomerProfiles(creditSales),
    [creditSales],
  );
  const filteredCustomers = useMemo(
    () => searchService.searchCustomers(customers, searchQuery),
    [customers, searchQuery],
  );
  const openCustomer = useMemo(
    () =>
      customers.find((c) => (c.phone || c.name) === openCustomerKey) || null,
    [customers, openCustomerKey],
  );

  if (loading) return <LoadingState />;

  return (
    <div style={styles.wrap}>
      <StickyScreenChrome>
        <ScreenHeader embedded Icon={Users} title={t("navCustomers")} subtitle={t("customersHint")} />
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("searchCustomersPlaceholder")} style={{ marginBottom: 0 }} />
      </StickyScreenChrome>

      {filteredCustomers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {customers.length > 0
              ? t("noMatchingCustomersMessage")
              : t("noCustomersYet")}
          </div>
          {customers.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("customersEmptyHint")}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.phone || customer.name}
              customer={customer}
              onOpen={() => setOpenCustomerKey(customer.phone || customer.name)}
            />
          ))}
        </div>
      )}

      <CustomerProfileModal
        visible={!!openCustomer}
        customer={openCustomer}
        businessName={settings.businessName}
        paymentAccounts={settings.paymentAccounts || []}
        onRecordPayment={handleRecordPayment}
        onClose={() => setOpenCustomerKey(null)}
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
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
};

export default CustomersScreen;


