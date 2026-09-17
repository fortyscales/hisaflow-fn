// Ported from the phone app's SearchService — plain substring matching
// across name/category, case-insensitive. Desktop had no product search
// at all until now, which becomes a real problem the moment a shop has
// more than a handful of products.
const norm = (val) => (val || "").toString().toLowerCase();

export const searchService = {
  searchProducts(products, query) {
    if (!query || !query.trim()) return products;
    // Token matching makes "coca 500", "500 ml" and "brand bottle" useful
    // without requiring the cashier to remember the exact product name.
    const tokens = norm(query).replace(/([0-9])([a-z])/g, "$1 $2").replace(/([a-z])([0-9])/g, "$1 $2").split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      const haystack = norm([p.name, p.category, p.brand, p.size, p.unit].filter(Boolean).join(" "))
        .replace(/([0-9])([a-z])/g, "$1 $2").replace(/([a-z])([0-9])/g, "$1 $2");
      return tokens.every((token) => haystack.includes(token));
    });
  },

  searchSales(sales, query) {
    if (!query || !query.trim()) return sales;
    const q = norm(query);
    return sales.filter(
      (s) =>
        norm(s.productName).includes(q) ||
        norm(s.productSize).includes(q) ||
        norm(s.productBrand).includes(q) ||
        norm(s.productCategory).includes(q) ||
        norm(s.customerName).includes(q) ||
        norm(s.customerPhone).includes(q),
    );
  },

  searchCustomers(customers, query) {
    if (!query || !query.trim()) return customers;
    const q = norm(query);
    return customers.filter(
      (c) => norm(c.name).includes(q) || norm(c.phone).includes(q),
    );
  },

  searchCreditSales(creditSales, query) {
    if (!query || !query.trim()) return creditSales;
    const q = norm(query);
    return creditSales.filter(
      (cs) =>
        norm(cs.customerName).includes(q) ||
        norm(cs.customerPhone).includes(q) ||
        (cs.items || []).some((item) => norm(item.productName).includes(q)),
    );
  },

  searchActivityLog(log, query) {
    if (!query || !query.trim()) return log;
    const q = norm(query);
    return log.filter(
      (entry) =>
        norm(entry.actorName).includes(q) ||
        norm(entry.action).includes(q) ||
        norm(entry.details).includes(q),
    );
  },

  searchSuppliers(suppliers, query) {
    if (!query || !query.trim()) return suppliers;
    const q = norm(query);
    return suppliers.filter(
      (s) => norm(s.name).includes(q) || norm(s.phone).includes(q),
    );
  },

  searchExpenditures(expenditures, query) {
    if (!query || !query.trim()) return expenditures;
    const q = norm(query);
    return expenditures.filter((exp) => norm(exp.description).includes(q));
  },

  searchOrders(orders, query) {
    if (!query || !query.trim()) return orders;
    const q = norm(query);
    return orders.filter(
      (o) =>
        norm(String(o.orderNumber)).includes(q) ||
        norm(o.issuedBy).includes(q) ||
        norm(o.customerName).includes(q) ||
        norm(o.customerPhone).includes(q) ||
        (o.items || []).some((item) => norm(item.productName).includes(q)),
    );
  },

  searchStaff(staff, query) {
    if (!query || !query.trim()) return staff;
    const q = norm(query);
    return staff.filter((s) => norm(s.name).includes(q));
  },

  searchAgingCustomers(customers, query) {
    if (!query || !query.trim()) return customers;
    const q = norm(query);
    return customers.filter(
      (c) =>
        norm(c.customerName).includes(q) || norm(c.customerPhone).includes(q),
    );
  },
};


