import * as XLSX from "xlsx";
import { dataService } from "./DataService";

const formatDateForExcel = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, Excel-friendly
};

// This is the actual reason HisaFlow exists — replacing the manual
// spreadsheet a shop owner currently maintains by hand. A real .xlsx file
// with separate sheets, not a CSV dump, since that's genuinely what
// someone coming from Excel expects to open.
export const exportService = {
  async exportToExcel() {
    const [products, sales, creditSales, expenditures, settings] =
      await Promise.all([
        dataService.getProducts(),
        dataService.getSales(),
        dataService.getCreditSales(),
        dataService.getExpenditures(),
        dataService.getSettings(),
      ]);

    const wb = XLSX.utils.book_new();

    const productsSheet = XLSX.utils.json_to_sheet(
      products.map((p) => ({
        Bidhaa: p.name,
        Kundi: p.category || "",
        Stoo: p.stock || 0,
        Kipimo: p.unit || "",
        "Bei ya Kununua": p.buyingPrice || 0,
        "Bei ya Kuuza": p.sellingPrice || 0,
        "Faida/kipande": (p.sellingPrice || 0) - (p.buyingPrice || 0),
        "Tarehe ya Mwisho": p.expiryDate
          ? formatDateForExcel(p.expiryDate)
          : "",
      })),
    );
    XLSX.utils.book_append_sheet(wb, productsSheet, "Bidhaa");

    const salesSheet = XLSX.utils.json_to_sheet(
      sales.map((s) => ({
        Tarehe: formatDateForExcel(s.date),
        Bidhaa: s.productName,
        Kiasi: s.quantity,
        "Bei ya Kuuza": s.sellingPrice,
        Jumla: s.totalRevenue,
        Faida: s.profit,
      })),
    );
    XLSX.utils.book_append_sheet(wb, salesSheet, "Mauzo");

    const creditRows = [];
    creditSales.forEach((cs) => {
      (cs.items || []).forEach((item) => {
        creditRows.push({
          Tarehe: formatDateForExcel(cs.date),
          Mteja: cs.customerName,
          "Namba ya Simu": cs.customerPhone || "",
          Bidhaa: item.productName,
          Kiasi: item.quantity,
          Jumla: cs.totalAmount,
          Kimelipwa: cs.amountPaid,
          Kilichobaki: cs.totalAmount - cs.amountPaid,
          Hali: cs.status,
        });
      });
    });
    const creditSheet = XLSX.utils.json_to_sheet(creditRows);
    XLSX.utils.book_append_sheet(wb, creditSheet, "Mikopo");

    const expenditureSheet = XLSX.utils.json_to_sheet(
      expenditures.map((exp) => ({
        Tarehe: formatDateForExcel(exp.date),
        Maelezo: exp.description,
        Kiasi: exp.amount,
        Aina: exp.type || "",
      })),
    );
    XLSX.utils.book_append_sheet(wb, expenditureSheet, "Matumizi");

    const totalRevenue = sales.reduce(
      (sum, s) => sum + (s.totalRevenue || 0),
      0,
    );
    const grossProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalExpenses = expenditures.reduce(
      (sum, exp) => sum + (exp.amount || 0),
      0,
    );
    const summarySheet = XLSX.utils.json_to_sheet([
      { Kipimo: "Jumla ya Bidhaa", Thamani: products.length },
      { Kipimo: "Jumla ya Mauzo", Thamani: sales.length },
      { Kipimo: "Mapato Jumla", Thamani: totalRevenue },
      { Kipimo: "Faida Jumla (kabla ya matumizi)", Thamani: grossProfit },
      { Kipimo: "Matumizi Jumla", Thamani: totalExpenses },
      { Kipimo: "Faida Halisi", Thamani: grossProfit - totalExpenses },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Muhtasari");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const businessName = (settings.businessName || "HisaFlow").replace(
      /[^a-zA-Z0-9]/g,
      "_",
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${businessName}_${dateStr}.xlsx`;

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


