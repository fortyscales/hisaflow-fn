import { dataService } from "./DataService";
import { batchService } from "./batchService";

// A realistic starting point for a Tanzanian small shop, so a new user
// sees the app actually working with real-looking data instead of a
// blank list — same idea as the phone app shipping with sample products
// on first install, just available on demand here instead.
const SAMPLE_PRODUCTS = [
  {
    name: "Soda (Coca-Cola)",
    category: "Vinywaji",
    unit: "pc",
    buyingPrice: 800,
    sellingPrice: 1000,
    stock: 24,
  },
  {
    name: "Sukari",
    category: "Vyakula",
    unit: "kg",
    buyingPrice: 2200,
    sellingPrice: 2500,
    stock: 50,
  },
  {
    name: "Mchele",
    category: "Vyakula",
    unit: "kg",
    buyingPrice: 2000,
    sellingPrice: 2400,
    stock: 40,
  },
  {
    name: "Sabuni ya Kuosha",
    category: "Usafi",
    unit: "pc",
    buyingPrice: 500,
    sellingPrice: 700,
    stock: 30,
  },
  {
    name: "Mafuta ya Kupikia",
    category: "Vyakula",
    unit: "lita",
    buyingPrice: 3500,
    sellingPrice: 4000,
    stock: 20,
  },
  {
    name: "Unga wa Ngano",
    category: "Vyakula",
    unit: "kg",
    buyingPrice: 1800,
    sellingPrice: 2100,
    stock: 35,
  },
];

export const sampleDataService = {
  async addSampleProducts() {
    const existing = await dataService.getProducts();
    const newProducts = SAMPLE_PRODUCTS.map((sample) => {
      const base = {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: sample.name,
        category: sample.category,
        unit: sample.unit,
        sellingPrice: sample.sellingPrice,
        stock: 0,
        buyingPrice: 0,
        stockBatches: [],
      };
      return batchService.addBatch(base, sample.stock, sample.buyingPrice);
    });

    await dataService.upsertProducts(newProducts);
    return { success: true, count: newProducts.length };
  },
};


