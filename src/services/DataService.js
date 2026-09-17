import { unwrapApplicationResult } from "./ApplicationError";

const command = async (name, payload) => unwrapApplicationResult(await window.hisaflow.command(name, payload));
const query = async (name, payload) => unwrapApplicationResult(await window.hisaflow.query(name, payload));

// Thin wrapper around the IPC bridge exposed in preload.js. Nothing in
// here talks to SQLite directly — persistence stays in Electron main and is
// reached exclusively through the preload/application boundary.

export const dataService = {
  getProducts: () => window.hisaflow.getProducts(),
  getProductsForBackup: () => window.hisaflow.getProductsForBackup(),
  restoreBackupData: (data) => window.hisaflow.restoreBackupData(data),
  createDatabaseSnapshot: (destinationPath) => window.hisaflow.createDatabaseSnapshot(destinationPath),
  validateDatabaseSnapshot: (snapshotPath) => window.hisaflow.validateDatabaseSnapshot(snapshotPath),
  restoreDatabaseSnapshot: (snapshotPath) => window.hisaflow.restoreDatabaseSnapshot(snapshotPath),
  upsertProducts: (products) => command("upsertProducts", { products }),
  deleteProducts: (productIds) => command("deleteProducts", { productIds }),

  getDashboardAnalytics: (args) => query("dashboard", args),
  getInventorySummary: () => window.hisaflow.getInventorySummary(),
  getReceivablesSummary: () => window.hisaflow.getReceivablesSummary(),
  getStaffSalesSummary: () => window.hisaflow.getStaffSalesSummary(),
  getOverdueReceivablesSummary: (args) => window.hisaflow.getOverdueReceivablesSummary(args),

  getSales: () => window.hisaflow.getSales(),
  getSalesPage: (args) => query("salesPage", args),

  getCreditSales: () => window.hisaflow.getCreditSales(),
  getExpenditures: () => window.hisaflow.getExpenditures(),
  getReportData: (args) => window.hisaflow.getReportData(args),
  exportPdf: (args) => window.hisaflow.exportPdf(args),
  listCommercialDocuments: (args) => window.hisaflow.listCommercialDocuments(args),
  getCommercialDocument: (id) => window.hisaflow.getCommercialDocument(id),
  createCommercialDocument: (args) => window.hisaflow.createCommercialDocument(args),
  convertQuotationToProforma: (id) => window.hisaflow.convertQuotationToProforma(id),
  setCommercialDocumentStatus: (id, status) => window.hisaflow.setCommercialDocumentStatus(id, status),
  convertProformaToCreditSale: (id, options) => window.hisaflow.convertProformaToCreditSale(id, options),
  convertProformaToSale: (id, options) => window.hisaflow.convertProformaToSale(id, options),
  listInvoices: (args) => window.hisaflow.listInvoices(args),
  getTaxSummary: (args) => window.hisaflow.getTaxSummary(args),

  getInvoiceByCreditSaleId: (id) => window.hisaflow.getInvoiceByCreditSaleId(id),
  createInvoice: (id, details) => window.hisaflow.createInvoice(id, details),
  getInvoiceBySaleId: (id) => window.hisaflow.getInvoiceBySaleId(id),
  createSaleInvoice: (id, details) => window.hisaflow.createSaleInvoice(id, details),
  addExpenditure: (expenditure) => command("addExpense", expenditure),
  deleteExpenditure: (id) => command("deleteExpense", { id }),

  getSuppliers: () => window.hisaflow.getSuppliers(),

  getStaff: () => window.hisaflow.getStaff(),

  getActivityLog: () => window.hisaflow.getActivityLog(),
  appendActivityLog: (entry) => command("appendActivityLog", { entry }),

  getCrashLog: () => window.hisaflow.getCrashLog(),
  appendCrashLog: (entry) => command("appendCrashLog", { entry }),
  clearCrashLog: () => command("clearCrashLog", {}),

  completeSale: (args) => command("completeSale", args),
  completeCartSale: (cartItems, meta) =>
    command("completeCartSale", { items: cartItems, meta }),
  completeCreditSale: (args) => command("completeCreditSale", args),

  addStaff: (args) => command("addStaff", args),
  updateStaff: (staffId, args) => command("updateStaff", { staffId, data: args }),
  deleteStaff: (staffId, actorName) =>
    command("deleteStaff", { staffId, actorName }),
  identifyStaffByPin: (pin) => window.hisaflow.identifyStaffByPin(pin),

  addSupplier: (args) => command("addSupplier", args),
  deleteSupplier: (supplierId) => command("deleteSupplier", { supplierId }),
  recordSupply: (supplierId, amount) =>
    command("recordSupply", { supplierId, amount }),
  recordSupplierPayment: (supplierId, amount, paymentMethod) =>
    command("recordSupplierPayment", { supplierId, amount, paymentMethod }),

  addStock: (args) => command("addStock", args),
  completeRestockCart: (cartItems, meta) =>
    command("completeRestockCart", { items: cartItems, meta }),

  editSale: (saleId, args) => command("editSale", { saleId, data: args }),
  deleteSale: (saleId, actorName, reason) =>
    command("deleteSale", { saleId, actorName, reason }),

  recordCreditPayment: (creditSaleId, amount, paymentMethod, account = null) =>
    command("recordCreditPayment", { creditSaleId, amount, paymentMethod, accountId: account?.id, accountLabel: account?.label, accountNumber: account?.accountNumber }),
  deleteCreditSale: (creditSaleId) =>
    command("deleteCreditSale", { creditSaleId }),

  createOrder: (args) => command("createOrder", args),
  getOrders: () => window.hisaflow.getOrders(),
  fulfillOrder: (orderId) => command("fulfillOrder", { orderId }),
  cancelOrder: (orderId) => command("cancelOrder", { orderId }),

  getLicenseStatus: () => window.hisaflow.getLicenseStatus(),
  activateLicense: (key) => window.hisaflow.activateLicense(key),

  getSettings: () => window.hisaflow.getSettings(),
  getAccountSummary: () => window.hisaflow.getAccountSummary(),
  getAccountStatement: (args) => window.hisaflow.getAccountStatement(args),
  saveSettings: (settings) => window.hisaflow.saveSettings(settings),
  resetOwnerPin: (newPin) => window.hisaflow.resetOwnerPin(newPin),
};


