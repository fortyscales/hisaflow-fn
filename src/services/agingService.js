// Accounts receivable aging — how overdue is what customers owe you,
// not just who owes it. Every credit sale already has a date and an
// outstanding balance; this just organizes what's already there into
// the view that actually matters for collecting money: current,
// 31-60 days, 61-90 days, and over 90 days overdue.
//
// Payables (what you owe suppliers) deliberately isn't built the same
// way here — suppliers currently track a single running balance rather
// than dated, discrete deliveries, so there's no reliable way to know
// how old a specific unpaid portion actually is. That would need a real
// data model change, not just a report on top of what exists today.

const daysSince = (dateStr, now) => {
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
};

const bucketFor = (daysOld) => {
  if (daysOld <= 30) return "current";
  if (daysOld <= 60) return "days31to60";
  if (daysOld <= 90) return "days61to90";
  return "over90";
};

export const agingService = {
  bucketFor,

  // Groups every credit sale with a real outstanding balance by
  // customer, splitting each customer's total across age buckets based
  // on each individual sale's own date — a customer with one old sale
  // and one recent one correctly shows debt in two different buckets,
  // not one blended age.
  buildReceivablesAging(creditSales, now = new Date()) {
    const byCustomer = {};
    for (const cs of creditSales) {
      const outstanding = cs.totalAmount - cs.amountPaid;
      if (outstanding <= 0) continue; // fully paid — not a receivable anymore

      const bucket = bucketFor(daysSince(cs.date, now));
      const key = cs.customerPhone || cs.customerName || cs.id;
      if (!byCustomer[key]) {
        byCustomer[key] = {
          customerName: cs.customerName || "—",
          customerPhone: cs.customerPhone || "",
          totalOutstanding: 0,
          buckets: { current: 0, days31to60: 0, days61to90: 0, over90: 0 },
          sales: [],
        };
      }
      byCustomer[key].totalOutstanding += outstanding;
      byCustomer[key].buckets[bucket] += outstanding;
      byCustomer[key].sales.push({
        id: cs.id,
        date: cs.date,
        outstanding,
        bucket,
      });
    }

    const customers = Object.values(byCustomer).sort(
      (a, b) => b.totalOutstanding - a.totalOutstanding,
    );

    const totals = customers.reduce(
      (sum, c) => ({
        current: sum.current + c.buckets.current,
        days31to60: sum.days31to60 + c.buckets.days31to60,
        days61to90: sum.days61to90 + c.buckets.days61to90,
        over90: sum.over90 + c.buckets.over90,
        grandTotal: sum.grandTotal + c.totalOutstanding,
      }),
      { current: 0, days31to60: 0, days61to90: 0, over90: 0, grandTotal: 0 },
    );

    return { customers, totals };
  },
};


