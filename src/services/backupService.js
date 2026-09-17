import { dataService } from "./DataService";

// Reuses the exact same Google Apps Script backend and phone+PIN identity
// scheme the phone app already uses — no new backend to build or
// maintain. A shop owner's phone number and PIN are the same recovery key
// on either device. Whether a phone backup and a desktop backup are fully
// interchangeable isn't something to promise without real testing (the
// two apps' data shapes differ in places, like batch-level stock
// tracking) — but both sitting behind one reliable, already-working
// mechanism is the right foundation regardless.
const GOOGLE_SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzagayUn9-o1O39-eKgHz7WsoUvfK9cO7Ip_jzA8yFokzBbm9Qwhm3GRAkZArSyK-UlNA/exec";

const gatherAllData = async () => {
  const [products, sales, creditSales, expenditures, suppliers, settings] =
    await Promise.all([
      dataService.getProductsForBackup(),
      dataService.getSales(),
      dataService.getCreditSales(),
      dataService.getExpenditures(),
      dataService.getSuppliers(),
      dataService.getSettings(),
    ]);
  return { products, sales, creditSales, expenditures, suppliers, settings };
};

const applyAllData = async (data) => {
  const result = await dataService.restoreBackupData(data);
  if (!result?.success) throw new Error(result?.error || "Backup restore failed");
};

export const backupService = {
  // ---- Local file backup — works immediately, no internet required ----

  async exportToFile() {
    const data = await gatherAllData();
    const settings = data.settings || {};
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const businessName = (settings.businessName || "HisaFlow").replace(
      /[^a-zA-Z0-9]/g,
      "_",
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${businessName}_backup_${dateStr}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, fileName };
  },

  async importFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.products && !data.sales) {
        return {
          success: false,
          error: "Faili hii si nakala sahihi ya HisaFlow",
        };
      }
      await applyAllData(data);
      return { success: true };
    } catch (error) {
      console.error("Import from file error:", error);
      return { success: false, error: "Imeshindikana kusoma faili hii" };
    }
  },

  // ---- Cloud backup — same backend, same identity as the phone app ----

  async pushToCloud(ownerPhone, ownerPin) {
    if (!ownerPhone || !ownerPin) {
      return {
        success: false,
        error: "Weka namba ya simu na PIN kwenye Mipangilio kwanza",
      };
    }
    try {
      const data = await gatherAllData();
      const jsonData = JSON.stringify(data);
      await fetch(
        `${GOOGLE_SHEETS_WEBHOOK_URL}?action=autobackup&businessId=${encodeURIComponent(ownerPhone)}&pin=${encodeURIComponent(ownerPin)}`,
        {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: jsonData,
        },
      );
      return { success: true };
    } catch (error) {
      console.error("Cloud backup push failed:", error);
      return { success: false, error: "Imeshindikana kuunganisha na intaneti" };
    }
  },

  async fetchFromCloud(ownerPhone, ownerPin) {
    if (!ownerPhone || !ownerPin) {
      return { success: false, error: "Weka namba ya simu na PIN" };
    }
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_WEBHOOK_URL}?action=getBackup&businessId=${encodeURIComponent(ownerPhone)}&pin=${encodeURIComponent(ownerPin)}`,
      );
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const result = await response.json();
      if (!result || result.error) {
        return {
          success: false,
          error:
            result?.error === "Incorrect PIN"
              ? "PIN si sahihi"
              : "Hakuna nakala iliyopatikana",
        };
      }
      if (!result.data) {
        return { success: false, error: "Hakuna nakala iliyopatikana" };
      }
      const data = JSON.parse(result.data);
      await applyAllData(data);
      return { success: true };
    } catch (error) {
      console.error("Cloud restore error:", error);
      return { success: false, error: "Imeshindikana kuunganisha na intaneti" };
    }
  },
};


