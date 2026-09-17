import { whatsappService } from "./whatsappService";

// Customer identity only exists through credit sales — cash checkout
// never asks for a name or phone. So a "customer" here is genuinely
// defined as an aggregation of every credit sale tied to the same
// normalized phone number, not a separately-managed record of its own.
export const customerService = {
  getCustomerProfiles(creditSales) {
    const profilesByPhone = new Map();

    creditSales.forEach((cs) => {
      const normalized = whatsappService.normalizePhone(cs.customerPhone);
      const key = normalized || `noPhone:${cs.customerName}`;

      const existing = profilesByPhone.get(key) || {
        phone: normalized,
        name: cs.customerName,
        totalSpent: 0,
        totalDebt: 0,
        transactionCount: 0,
        lastPurchaseDate: cs.date,
        creditSales: [],
      };

      existing.totalSpent += cs.totalAmount;
      existing.totalDebt += cs.totalAmount - cs.amountPaid;
      existing.transactionCount += 1;
      existing.creditSales.push(cs);
      if (new Date(cs.date) > new Date(existing.lastPurchaseDate)) {
        existing.lastPurchaseDate = cs.date;
        existing.name = cs.customerName; // most recent name wins, in case of a typo fix
      }

      profilesByPhone.set(key, existing);
    });

    return Array.from(profilesByPhone.values()).sort(
      (a, b) => new Date(b.lastPurchaseDate) - new Date(a.lastPurchaseDate),
    );
  },
};


