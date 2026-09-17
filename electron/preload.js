const { contextBridge, ipcRenderer } = require("electron");

// Everything the renderer (React app) can touch is explicitly listed
// here — nothing more. This is what contextIsolation is for: even though
// this file has full Node access, only what's exposed below is reachable
// from the actual UI code.
contextBridge.exposeInMainWorld("hisaflow", {
  command: (name, payload) => ipcRenderer.invoke("app:commandSafe", name, payload),
  query: (name, payload) => ipcRenderer.invoke("app:querySafe", name, payload),
  getProducts: () => ipcRenderer.invoke("data:getProducts"),
  getProductsForBackup: () => ipcRenderer.invoke("backup:getProducts"),
  restoreBackupData: (data) => ipcRenderer.invoke("backup:restoreAll", data),
  createDatabaseSnapshot: (destinationPath) => ipcRenderer.invoke("backup:createSnapshot", destinationPath),
  validateDatabaseSnapshot: (snapshotPath) => ipcRenderer.invoke("backup:validateSnapshot", snapshotPath),
  restoreDatabaseSnapshot: (snapshotPath) => ipcRenderer.invoke("backup:restoreSnapshot", snapshotPath),

  getDashboardAnalytics: (args) => ipcRenderer.invoke("analytics:dashboard", args),
  getInventorySummary: () => ipcRenderer.invoke("analytics:inventorySummary"),
  getReceivablesSummary: () => ipcRenderer.invoke("analytics:receivablesSummary"),
  getStaffSalesSummary: () => ipcRenderer.invoke("analytics:staffSales"),
  getOverdueReceivablesSummary: (args) => ipcRenderer.invoke("analytics:overdueReceivables", args),

  getSales: () => ipcRenderer.invoke("data:getSales"),
  getSalesPage: (args) => ipcRenderer.invoke("sales:getPage", args),

  getCreditSales: () => ipcRenderer.invoke("data:getCreditSales"),
  getExpenditures: () => ipcRenderer.invoke("data:getExpenditures"),
  getReportData: (args) => ipcRenderer.invoke("reports:getData", args),
  exportPdf: (args) => ipcRenderer.invoke("documents:exportPdf", args),
  listCommercialDocuments: (args) => ipcRenderer.invoke("commercialDocuments:list", args),
  getCommercialDocument: (id) => ipcRenderer.invoke("commercialDocuments:get", id),
  createCommercialDocument: (args) => ipcRenderer.invoke("commercialDocuments:create", args),
  convertQuotationToProforma: (id) => ipcRenderer.invoke("commercialDocuments:convertToProforma", id),
  setCommercialDocumentStatus: (id, status) => ipcRenderer.invoke("commercialDocuments:setStatus", id, status),
  convertProformaToCreditSale: (id, options) => ipcRenderer.invoke("commercialDocuments:convertToCreditSale", id, options),
  convertProformaToSale: (id, options) => ipcRenderer.invoke("commercialDocuments:convertToSale", id, options),
  listInvoices: (args) => ipcRenderer.invoke("invoices:list", args),
  getTaxSummary: (args) => ipcRenderer.invoke("tax:summary", args),

  getInvoiceByCreditSaleId: (id) => ipcRenderer.invoke("invoices:getByCreditSaleId", id),
  createInvoice: (id, details) => ipcRenderer.invoke("invoices:create", id, details),
  getInvoiceBySaleId: (id) => ipcRenderer.invoke("invoices:getBySaleId", id),
  createSaleInvoice: (id, details) => ipcRenderer.invoke("invoices:createForSale", id, details),

  getSuppliers: () => ipcRenderer.invoke("data:getSuppliers"),
  getStaff: () => ipcRenderer.invoke("data:getStaff"),

  getActivityLog: () => ipcRenderer.invoke("data:getActivityLog"),

  getCrashLog: () => ipcRenderer.invoke("data:getCrashLog"),
  getOrders: () => ipcRenderer.invoke("orders:getOrders"),

  identifyStaffByPin: (pin) => ipcRenderer.invoke("staff:identifyByPin", pin),


  getLicenseStatus: () => ipcRenderer.invoke("license:getStatus"),
  activateLicense: (key) => ipcRenderer.invoke("license:activate", key),

  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  copyImageToClipboard: (dataUrl) =>
    ipcRenderer.invoke("clipboard:writeImage", dataUrl),

  getDatabaseHealth: () => ipcRenderer.invoke("system:databaseHealth"),
  getStartupHealth: () => ipcRenderer.invoke("system:startupHealth"),
  getDiagnostics: () => ipcRenderer.invoke("system:diagnostics"),
  exportDiagnostics: (destinationPath) => ipcRenderer.invoke("system:exportDiagnostics", destinationPath),
  getInventoryReconciliation: (limit) => ipcRenderer.invoke("system:inventoryReconciliation", limit),
  getSyncIdentity: () => ipcRenderer.invoke("sync:identity"),
  getSyncStatus: () => ipcRenderer.invoke("sync:status"),
  leaseSyncEvents: (options) => ipcRenderer.invoke("sync:lease", options),
  acknowledgeSyncEvents: (leaseToken, eventIds) => ipcRenderer.invoke("sync:ack", leaseToken, eventIds),
  failSyncEvents: (leaseToken, failures) => ipcRenderer.invoke("sync:fail", leaseToken, failures),
  releaseSyncLease: (leaseToken) => ipcRenderer.invoke("sync:release", leaseToken),
  getStockMovements: (productId, options) => ipcRenderer.invoke("inventory:movements", productId, options),
  repairProductSummaries: () => ipcRenderer.invoke("system:repairProductSummaries"),

  getSettings: () => ipcRenderer.invoke("data:getSettings"),
  getAccountSummary: () => ipcRenderer.invoke("accounts:summary"),
  getAccountStatement: (args) => ipcRenderer.invoke("accounts:statement", args),
  saveSettings: (settings) => ipcRenderer.invoke("data:saveSettings", settings),
  resetOwnerPin: (newPin) => ipcRenderer.invoke("data:resetOwnerPin", newPin),
});


