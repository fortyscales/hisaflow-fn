// One place for "what needs attention right now" — reused by both the
// dashboard banners and the desktop notification, so the two can never
// silently disagree about what counts as low stock or expiring soon.
//
// One honest scope note: the phone app tracks expiry per batch (a
// product restocked twice could have two different expiry dates).
// Desktop only tracks expiry at the whole-product level — this uses
// that simpler model rather than pretending per-batch tracking exists
// here too.

const daysUntil = (dateString) => {
  if (!dateString) return null;
  return Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24));
};

export const alertService = {
  getLowStockAlerts(products, threshold = 10) {
    const outOfStock = products.filter((p) => (p.stock || 0) === 0);
    const lowStock = products.filter(
      (p) => (p.stock || 0) > 0 && (p.stock || 0) <= threshold,
    );
    return { outOfStock, lowStock, total: outOfStock.length + lowStock.length };
  },

  getExpiryAlerts(products, warningDays = 30) {
    const expired = [];
    const expiringSoon = [];
    products.forEach((p) => {
      const days = daysUntil(p.expiryDate);
      if (days === null) return;
      if (days < 0) expired.push(p);
      else if (days <= warningDays) expiringSoon.push(p);
    });
    return {
      expired,
      expiringSoon,
      total: expired.length + expiringSoon.length,
    };
  },
};


