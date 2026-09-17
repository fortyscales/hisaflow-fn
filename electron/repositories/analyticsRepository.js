const { db } = require('../db');

function salesUnionSql() {
  return `
    SELECT s.product_id AS product_id, s.product_name AS product_name,
           s.quantity AS quantity, s.total_revenue AS revenue, s.profit AS profit,
           s.date AS date, s.actor_name AS actor_name
    FROM sales s
    UNION ALL
    SELECT i.product_id AS product_id, i.product_name AS product_name,
           i.quantity AS quantity, (i.selling_price * i.quantity) AS revenue,
           ((i.selling_price * i.quantity) - (COALESCE(i.cost_at_sale, 0) * i.quantity)) AS profit,
           cs.date AS date, cs.actor_name AS actor_name
    FROM credit_sale_items i
    JOIN credit_sales cs ON cs.id = i.credit_sale_id
  `;
}

function periodClause(alias, start, end) {
  const parts = [];
  if (start) parts.push(`${alias}.date >= @start`);
  if (end) parts.push(`${alias}.date < @end`);
  return parts.length ? parts.join(' AND ') : '1=1';
}

function getDashboardAnalytics({ start = null, end = null, actorName = null, isOwner = true, limit = 5 } = {}) {
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 5));
  const params = { start, end, actorName };
  const saleDate = periodClause('u', start, end);
  const expenseDate = periodClause('e', start, end);
  const actor = !isOwner && actorName ? 'AND u.actor_name = @actorName' : '';

  const totals = db.prepare(`
    WITH unified_sales AS (${salesUnionSql()})
    SELECT COALESCE(SUM(u.revenue), 0) AS revenue,
           COALESCE(SUM(u.profit), 0) AS gross_profit,
           COUNT(*) AS transaction_count
    FROM unified_sales u
    WHERE ${saleDate} ${actor}
  `).get(params);

  const expenses = isOwner
    ? db.prepare(`SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenditures e WHERE ${expenseDate}`).get(params).total
    : 0;

  // Best sellers are deliberately shop-wide even for staff: quantity movement is
  // operational information, while revenue/cost/profit remain permission-scoped.
  const bestSellers = db.prepare(`
    WITH unified_sales AS (${salesUnionSql()})
    SELECT u.product_id AS id, COALESCE(p.name, MAX(u.product_name)) AS name,
           COALESCE(p.unit, 'pc') AS unit, SUM(u.quantity) AS quantity
    FROM unified_sales u
    LEFT JOIN products p ON p.id = u.product_id
    WHERE ${saleDate}
    GROUP BY u.product_id
    ORDER BY quantity DESC, name COLLATE NOCASE ASC
    LIMIT @limit
  `).all({ ...params, limit: safeLimit }).map(r => ({
    product: { id: r.id, name: r.name, unit: r.unit }, quantity: r.quantity,
  }));

  const mostProfitable = isOwner ? db.prepare(`
    WITH unified_sales AS (${salesUnionSql()})
    SELECT u.product_id AS id, COALESCE(p.name, MAX(u.product_name)) AS name,
           COALESCE(p.unit, 'pc') AS unit, SUM(u.profit) AS profit
    FROM unified_sales u
    LEFT JOIN products p ON p.id = u.product_id
    WHERE ${saleDate}
    GROUP BY u.product_id
    ORDER BY profit DESC, name COLLATE NOCASE ASC
    LIMIT @limit
  `).all({ ...params, limit: safeLimit }).map(r => ({
    product: { id: r.id, name: r.name, unit: r.unit }, profit: r.profit,
  })) : [];

  return {
    totalRevenue: totals.revenue,
    totalExpenses: expenses,
    grossProfit: isOwner ? totals.gross_profit : 0,
    netProfit: isOwner ? totals.gross_profit - expenses : 0,
    transactionCount: totals.transaction_count,
    bestSellers,
    mostProfitable,
    maxSellerQty: bestSellers[0]?.quantity || 1,
    maxProfitAmount: mostProfitable[0]?.profit || 1,
  };
}

function getInventorySummary() {
  return db.prepare(`
    SELECT COUNT(*) AS product_count,
           COALESCE(SUM(stock), 0) AS units_in_stock,
           COALESCE(SUM(stock * buying_price), 0) AS inventory_cost_value,
           COALESCE(SUM(stock * selling_price), 0) AS inventory_retail_value
    FROM products
  `).get();
}

function getReceivablesSummary() {
  return db.prepare(`
    SELECT COUNT(*) AS credit_sale_count,
           COALESCE(SUM(total_amount), 0) AS total_credit,
           COALESCE(SUM(amount_paid), 0) AS total_paid,
           COALESCE(SUM(total_amount - amount_paid), 0) AS outstanding
    FROM credit_sales
    WHERE status <> 'cancelled'
  `).get();
}

function getStaffSalesSummary() {
  const rows = db.prepare(`
    WITH cash AS (
      SELECT actor_name, COUNT(*) AS cash_count, COALESCE(SUM(total_revenue), 0) AS cash_revenue
      FROM sales WHERE actor_name IS NOT NULL GROUP BY actor_name
    ), credit AS (
      SELECT actor_name, COUNT(*) AS credit_count, COALESCE(SUM(total_amount), 0) AS credit_revenue
      FROM credit_sales WHERE actor_name IS NOT NULL GROUP BY actor_name
    ), actors AS (
      SELECT actor_name FROM cash UNION SELECT actor_name FROM credit
    )
    SELECT a.actor_name, COALESCE(c.cash_count, 0) AS cash_count,
           COALESCE(c.cash_revenue, 0) AS cash_revenue,
           COALESCE(cr.credit_count, 0) AS credit_count,
           COALESCE(cr.credit_revenue, 0) AS credit_revenue
    FROM actors a
    LEFT JOIN cash c ON c.actor_name = a.actor_name
    LEFT JOIN credit cr ON cr.actor_name = a.actor_name
  `).all();
  const result = {};
  for (const r of rows) result[r.actor_name] = {
    cashCount: r.cash_count, cashRevenue: r.cash_revenue,
    creditCount: r.credit_count, creditRevenue: r.credit_revenue,
    totalCount: r.cash_count + r.credit_count,
    totalRevenue: r.cash_revenue + r.credit_revenue,
  };
  return result;
}

function getOverdueReceivablesSummary({ cutoff }) {
  return db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(NULLIF(customer_phone, ''), NULLIF(customer_name, ''), id)) AS customer_count,
           COALESCE(SUM(total_amount - amount_paid), 0) AS overdue_total
    FROM credit_sales
    WHERE (total_amount - amount_paid) > 0 AND date < @cutoff
  `).get({ cutoff });
}

module.exports = { getDashboardAnalytics, getInventorySummary, getReceivablesSummary, getStaffSalesSummary, getOverdueReceivablesSummary };
