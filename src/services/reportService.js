import * as XLSX from "xlsx";
import { dataService } from "./DataService";

// Ported from the phone app's ReportService, adapted for one real
// structural difference: on the phone, a credit sale is per-product; on
// desktop, one credit sale is a whole cart (customer buys several things
// on credit in one transaction). Per-item profit still works cleanly
// (each item carries its own costAtSale), but payment status only makes
// sense at the cart level — you can't cleanly say "this specific item is
// half-paid" when the customer paid against the whole cart. So credit
// sales are flattened to one row per item for profit/revenue purposes,
// but shown at the cart level for payment status.

const formatDateForSheet = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("sw-TZ");
};

const CURRENCY_FORMAT = '#,##0 "TZS"';
const NUMBER_FORMAT = "#,##0";

const buildTableSheet = (
  headers,
  rows,
  { widths, currencyCols = [], numberCols = [] } = {},
) => {
  const dataRows = rows.length ? rows : [["Hakuna data kwa kipindi hiki"]];

  const blankRow = [];
  const headerRow = ["", ...headers];
  const indentedRows = dataRows.map((r) => ["", ...r]);

  const aoa = [blankRow, headerRow, ...indentedRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  if (widths) {
    ws["!cols"] = [{ wch: 3 }, ...widths.map((w) => ({ wch: w }))];
  }

  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 2,
    topLeftCell: "A3",
    activePane: "bottomLeft",
    state: "frozen",
  };

  if (rows.length) {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 2; R <= range.e.r; R++) {
      currencyCols.forEach((C) => {
        const ref = XLSX.utils.encode_cell({ r: R, c: C + 1 });
        if (ws[ref] && typeof ws[ref].v === "number")
          ws[ref].z = CURRENCY_FORMAT;
      });
      numberCols.forEach((C) => {
        const ref = XLSX.utils.encode_cell({ r: R, c: C + 1 });
        if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = NUMBER_FORMAT;
      });
    }
  }

  return ws;
};

const buildSummarySheet = ({ businessName, startDate, endDate, metrics }) => {
  const contentRows = [
    [businessName],
    [
      `Kipindi: ${formatDateForSheet(startDate)} - ${formatDateForSheet(endDate)}`,
    ],
    [`Ilitengenezwa: ${new Date().toLocaleString("sw-TZ")}`],
    [],
    ["MUHTASARI WA BIASHARA"],
    ["Jumla ya Mapato (Mauzo Taslimu)", metrics.totalRevenue],
    ["Jumla ya Faida (Mauzo Taslimu)", metrics.totalProfitCash],
    ["Jumla ya Faida (Mauzo ya Mkopo)", metrics.totalProfitCredit],
    ["Jumla ya Faida ya Mauzo Yote", metrics.totalProfitCombined],
    ["Jumla ya Matumizi", metrics.totalExpenditure],
    ["Faida Halisi (Baada ya Matumizi)", metrics.netProfit],
    [
      "Madeni Yanayosubiri (Mikopo, Kipindi Hiki)",
      metrics.totalCreditOutstanding,
    ],
    ["Thamani ya Sasa ya Stock", metrics.totalStockValue],
    [],
    ["IDADI", ""],
    ["Bidhaa Tofauti", metrics.productCount],
    ["Mauzo Taslimu", metrics.salesCount],
    ["Mauzo ya Mkopo (Miamala)", metrics.creditSalesCount],
    ["Matumizi", metrics.expenditureCount],
  ];

  const indentedRows = contentRows.map((r) => (r.length ? ["", ...r] : []));
  const rows = [[], ...indentedRows];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 3 }, { wch: 42 }, { wch: 26 }];

  const ROW_OFFSET = 1;
  const COL_OFFSET = 1;

  ws["!merges"] = [
    {
      s: { r: 0 + ROW_OFFSET, c: 0 + COL_OFFSET },
      e: { r: 0 + ROW_OFFSET, c: 1 + COL_OFFSET },
    },
    {
      s: { r: 4 + ROW_OFFSET, c: 0 + COL_OFFSET },
      e: { r: 4 + ROW_OFFSET, c: 1 + COL_OFFSET },
    },
    {
      s: { r: 14 + ROW_OFFSET, c: 0 + COL_OFFSET },
      e: { r: 14 + ROW_OFFSET, c: 1 + COL_OFFSET },
    },
  ];

  [5, 6, 7, 8, 9, 10, 11, 12].forEach((r) => {
    const ref = XLSX.utils.encode_cell({
      r: r + ROW_OFFSET,
      c: 1 + COL_OFFSET,
    });
    if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = CURRENCY_FORMAT;
  });

  return ws;
};

export const reportService = {
  getDateRange(periodId) {
    const now = new Date();
    let startDate;
    const endDate = now;

    switch (periodId) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week": {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        break;
      }
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter": {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
        break;
      }
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "all":
      default:
        startDate = new Date(2000, 0, 1);
        break;
    }
    return { startDate, endDate };
  },

  async generateReport({ startDate, endDate }) {
    const [products, sales, creditSales, expenditures, settings] =
      await Promise.all([
        dataService.getProducts(),
        dataService.getSales(),
        dataService.getCreditSales(),
        dataService.getExpenditures(),
        dataService.getSettings(),
      ]);

    const businessName = settings.businessName || "HisaFlow";
    const inRange = (dateString) => {
      const d = new Date(dateString);
      return d >= startDate && d <= endDate;
    };

    const rangeSales = sales.filter((s) => inRange(s.date));
    const rangeCreditSales = creditSales.filter((cs) => inRange(cs.date));
    const rangeExpenditures = expenditures.filter((e) => inRange(e.date));

    // Flattened per-item view of credit sales — needed for accurate
    // per-product and per-item profit, since costAtSale lives on the item.
    const rangeCreditItems = rangeCreditSales.flatMap((cs) =>
      (cs.items || []).map((item) => ({
        ...item,
        creditSaleId: cs.id,
        date: cs.date,
        customerName: cs.customerName,
      })),
    );

    // ---- Metrics for summary ----
    const totalRevenue = rangeSales.reduce(
      (sum, s) => sum + (s.totalRevenue || 0),
      0,
    );
    const totalProfitCash = rangeSales.reduce(
      (sum, s) => sum + (s.profit || 0),
      0,
    );
    const totalProfitCredit = rangeCreditItems.reduce(
      (sum, item) =>
        sum + (item.sellingPrice - (item.costAtSale || 0)) * item.quantity,
      0,
    );
    const totalProfitCombined = totalProfitCash + totalProfitCredit;
    const totalExpenditure = rangeExpenditures.reduce(
      (sum, e) => sum + (e.amount || 0),
      0,
    );
    const netProfit = totalProfitCombined - totalExpenditure;
    const totalCreditOutstanding = rangeCreditSales.reduce(
      (sum, cs) => sum + (cs.totalAmount - (cs.amountPaid || 0)),
      0,
    );
    const totalStockValue = products.reduce(
      (sum, p) => sum + (p.buyingPrice || 0) * (p.stock || 0),
      0,
    );

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      buildSummarySheet({
        businessName,
        startDate,
        endDate,
        metrics: {
          totalRevenue,
          totalProfitCash,
          totalProfitCredit,
          totalProfitCombined,
          totalExpenditure,
          netProfit,
          totalCreditOutstanding,
          totalStockValue,
          productCount: products.length,
          salesCount: rangeSales.length,
          creditSalesCount: rangeCreditSales.length,
          expenditureCount: rangeExpenditures.length,
        },
      }),
      "Muhtasari",
    );

    // ---- Bidhaa: per-product rollup ----
    const productMap = new Map();
    products.forEach((p) => {
      productMap.set(p.id, {
        name: p.name,
        category: p.category,
        unit: p.unit || "pc",
        stock: p.stock || 0,
        qtyCash: 0,
        qtyCredit: 0,
        profit: 0,
      });
    });
    const ensureProductEntry = (id, fallback) => {
      if (!productMap.has(id)) {
        productMap.set(id, {
          name: fallback.name || "Bidhaa Iliyofutwa",
          category: "",
          unit: "pc",
          stock: 0,
          qtyCash: 0,
          qtyCredit: 0,
          profit: 0,
        });
      }
      return productMap.get(id);
    };
    rangeSales.forEach((s) => {
      const entry = ensureProductEntry(s.productId, { name: s.productName });
      entry.qtyCash += s.quantity || 0;
      entry.profit += s.profit || 0;
    });
    rangeCreditItems.forEach((item) => {
      const entry = ensureProductEntry(item.productId, {
        name: item.productName,
      });
      entry.qtyCredit += item.quantity || 0;
      entry.profit +=
        (item.sellingPrice - (item.costAtSale || 0)) * item.quantity;
    });

    const sortedProductEntries = Array.from(productMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const productRows = sortedProductEntries.map((e) => [
      e.name,
      e.category,
      e.stock,
      e.unit,
      e.qtyCash,
      e.qtyCredit,
      e.qtyCash + e.qtyCredit,
      e.profit,
    ]);
    const productTotals = sortedProductEntries.reduce(
      (acc, e) => ({
        stock: acc.stock + e.stock,
        qtyCash: acc.qtyCash + e.qtyCash,
        qtyCredit: acc.qtyCredit + e.qtyCredit,
        profit: acc.profit + e.profit,
      }),
      { stock: 0, qtyCash: 0, qtyCredit: 0, profit: 0 },
    );
    productRows.push([
      "JUMLA (TOTAL)",
      "",
      productTotals.stock,
      "",
      productTotals.qtyCash,
      productTotals.qtyCredit,
      productTotals.qtyCash + productTotals.qtyCredit,
      productTotals.profit,
    ]);

    XLSX.utils.book_append_sheet(
      wb,
      buildTableSheet(
        [
          "Jina",
          "Aina",
          "Stock Iliyopo",
          "Kipimo",
          "Kiasi Kilichouzwa (Taslimu)",
          "Kiasi Kilichouzwa (Mkopo)",
          "Jumla Kiasi Kilichouzwa",
          "Faida Iliyopatikana",
        ],
        productRows,
        {
          widths: [30, 16, 16, 14, 26, 26, 24, 22],
          currencyCols: [7],
          numberCols: [2, 4, 5, 6],
        },
      ),
      "Bidhaa",
    );

    // ---- Mauzo Yote: cash sales + credit items combined, chronological ----
    const combinedSorted = [
      ...rangeSales.map((s) => ({
        date: new Date(s.date),
        type: "cash",
        data: s,
      })),
      ...rangeCreditItems.map((item) => ({
        date: new Date(item.date),
        type: "credit",
        data: item,
      })),
    ].sort((a, b) => a.date - b.date);

    const salesTableRows = combinedSorted.map(({ type, data }) => {
      if (type === "cash") {
        const margin =
          data.totalRevenue > 0 ? (data.profit / data.totalRevenue) * 100 : 0;
        return [
          formatDateForSheet(data.date),
          data.productName,
          data.quantity,
          data.sellingPrice,
          data.totalRevenue,
          data.profit,
          margin,
          "Taslimu",
          "",
        ];
      }
      const totalRevenue = data.sellingPrice * data.quantity;
      const profit =
        (data.sellingPrice - (data.costAtSale || 0)) * data.quantity;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      return [
        formatDateForSheet(data.date),
        data.productName,
        data.quantity,
        data.sellingPrice,
        totalRevenue,
        profit,
        margin,
        "Mkopo",
        data.customerName || "",
      ];
    });

    if (salesTableRows.length) {
      const salesTotals = combinedSorted.reduce(
        (acc, { type, data }) => {
          const revenue =
            type === "cash"
              ? data.totalRevenue || 0
              : data.sellingPrice * data.quantity;
          const profit =
            type === "cash"
              ? data.profit || 0
              : (data.sellingPrice - (data.costAtSale || 0)) * data.quantity;
          acc.quantity += data.quantity || 0;
          acc.total += revenue;
          acc.profit += profit;
          return acc;
        },
        { quantity: 0, total: 0, profit: 0 },
      );
      salesTableRows.push([
        "",
        "JUMLA (TOTAL)",
        salesTotals.quantity,
        "",
        salesTotals.total,
        salesTotals.profit,
        "",
        "",
        "",
      ]);
    }

    XLSX.utils.book_append_sheet(
      wb,
      buildTableSheet(
        [
          "Tarehe",
          "Bidhaa",
          "Idadi",
          "Bei ya Kuuzia",
          "Mapato/Jumla",
          "Faida",
          "Faida %",
          "Aina ya Malipo",
          "Mteja",
        ],
        salesTableRows,
        {
          widths: [14, 28, 10, 18, 18, 18, 12, 16, 24],
          currencyCols: [3, 4, 5],
          numberCols: [2],
        },
      ),
      "Mauzo Yote",
    );

    // ---- Malipo ya Mikopo: one row per credit sale (cart), payment status at that level ----
    const creditDetailRows = rangeCreditSales.map((cs) => {
      const itemsSummary = (cs.items || [])
        .map((i) => i.productName)
        .join(", ");
      return [
        formatDateForSheet(cs.date),
        cs.customerName,
        cs.customerPhone || "",
        itemsSummary,
        cs.totalAmount,
        cs.amountPaid || 0,
        cs.totalAmount - (cs.amountPaid || 0),
        cs.status,
      ];
    });

    if (creditDetailRows.length) {
      const creditTotals = rangeCreditSales.reduce(
        (acc, cs) => ({
          total: acc.total + (cs.totalAmount || 0),
          paid: acc.paid + (cs.amountPaid || 0),
          remaining: acc.remaining + (cs.totalAmount - (cs.amountPaid || 0)),
        }),
        { total: 0, paid: 0, remaining: 0 },
      );
      creditDetailRows.push([
        "",
        "JUMLA (TOTAL)",
        "",
        "",
        creditTotals.total,
        creditTotals.paid,
        creditTotals.remaining,
        "",
      ]);
    }

    XLSX.utils.book_append_sheet(
      wb,
      buildTableSheet(
        [
          "Tarehe",
          "Mteja",
          "Simu",
          "Bidhaa",
          "Jumla",
          "Imelipwa",
          "Bado",
          "Hali",
        ],
        creditDetailRows,
        { widths: [14, 24, 16, 34, 18, 18, 18, 14], currencyCols: [4, 5, 6] },
      ),
      "Malipo ya Mikopo",
    );

    // ---- Matumizi ----
    const expenditureRows = rangeExpenditures.map((e) => [
      formatDateForSheet(e.date),
      e.description,
      e.type || "",
      e.amount,
    ]);
    if (expenditureRows.length) {
      const expenditureTotal = rangeExpenditures.reduce(
        (sum, e) => sum + (e.amount || 0),
        0,
      );
      expenditureRows.push(["", "JUMLA (TOTAL)", "", expenditureTotal]);
    }

    XLSX.utils.book_append_sheet(
      wb,
      buildTableSheet(["Tarehe", "Maelezo", "Aina", "Kiasi"], expenditureRows, {
        widths: [14, 34, 16, 18],
        currencyCols: [3],
      }),
      "Matumizi",
    );

    // ---- Write & download ----
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const startTag = startDate.toISOString().split("T")[0];
    const endTag = endDate.toISOString().split("T")[0];
    const fileName = `ripoti-${startTag}_${endTag}.xlsx`;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, fileName };
  },
};


