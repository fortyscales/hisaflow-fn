// Kept separate from DashboardScreen for the same reason as everything
// else — pure logic, easy to verify, reusable if another screen ever
// wants period-based stats.

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = () => {
  const d = startOfToday();
  d.setDate(d.getDate() - d.getDay()); // Sunday, same convention used elsewhere in this app
  return d;
};

const startOfMonth = () => {
  const d = startOfToday();
  d.setDate(1);
  return d;
};

const startOfQuarter = () => {
  const d = startOfToday();
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  d.setMonth(quarterStartMonth, 1);
  return d;
};

const startOfYear = () => {
  const d = startOfToday();
  d.setMonth(0, 1);
  return d;
};

export const analyticsService = {
  // Credit sales earn their profit the moment the sale happens — goods
  // leave the shelf at a known cost, sold at a known price — regardless
  // of whether the cash has actually been collected yet. Without this,
  // a shop doing real credit business would see revenue and profit that
  // only reflects cash sales, while expenses (unrelated to payment
  // method) count in full — making net profit look falsely negative.
  // Each credit sale item is converted into the same shape a regular
  // sale uses, so both can be combined for revenue, profit, and
  // best-seller calculations.
  flattenCreditSaleItems(creditSales) {
    const flattened = [];
    creditSales.forEach((cs) => {
      (cs.items || []).forEach((item) => {
        const cost = (item.costAtSale || 0) * item.quantity;
        const revenue = item.sellingPrice * item.quantity;
        flattened.push({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          totalRevenue: revenue,
          profit: revenue - cost,
          date: cs.date,
        });
      });
    });
    return flattened;
  },

  filterSalesByPeriod(sales, period) {
    if (period === "all") return sales;
    // Previously any period other than 'today'/'week'/'all' silently
    // fell through to month boundaries — meaning 'quarter' and 'year'
    // were both quietly computing month-to-date instead. Explicit cases
    // now, no fallthrough default that could misrepresent an unrecognized
    // period as something else.
    const boundary =
      period === "today"
        ? startOfToday()
        : period === "week"
          ? startOfWeek()
          : period === "month"
            ? startOfMonth()
            : period === "quarter"
              ? startOfQuarter()
              : period === "year"
                ? startOfYear()
                : startOfToday(); // unrecognized period — narrowest, safest fallback
    return sales.filter((s) => new Date(s.date) >= boundary);
  },

  getBestSellers(products, sales, limit = 5) {
    const quantityByProduct = {};
    sales.forEach((s) => {
      quantityByProduct[s.productId] =
        (quantityByProduct[s.productId] || 0) + (s.quantity || 0);
    });
    return Object.entries(quantityByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, quantity } : null;
      })
      .filter(Boolean);
  },

  getMostProfitable(products, sales, limit = 5) {
    const profitByProduct = {};
    sales.forEach((s) => {
      profitByProduct[s.productId] =
        (profitByProduct[s.productId] || 0) + (s.profit || 0);
    });
    return Object.entries(profitByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId, profit]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, profit } : null;
      })
      .filter(Boolean);
  },

  // Per staff member, how many cash sales vs credit sales they
  // personally made, matched by the actor name recorded at the moment
  // of each sale (same field SaleCard/Dashboard already use to gate
  // profit data). Owner-made sales are counted too if the owner's name
  // matches, but this is meant to be read per staff member, not as a
  // shop-wide total.
  getStaffSalesBreakdown(staff, sales, creditSales) {
    return staff.map((member) => {
      const cashSales = sales.filter((s) => s.actorName === member.name);
      const memberCreditSales = creditSales.filter(
        (cs) => cs.actorName === member.name,
      );
      const cashRevenue = cashSales.reduce(
        (sum, s) => sum + (s.totalRevenue || 0),
        0,
      );
      const creditRevenue = memberCreditSales.reduce(
        (sum, cs) => sum + (cs.totalAmount || 0),
        0,
      );
      return {
        staffId: member.id,
        cashCount: cashSales.length,
        cashRevenue,
        creditCount: memberCreditSales.length,
        creditRevenue,
        totalCount: cashSales.length + memberCreditSales.length,
        totalRevenue: cashRevenue + creditRevenue,
      };
    });
  },
};


