// Ported from the phone app's FilterService — filtering and sorting for
// products. Desktop's Products screen only had an All/Popular toggle
// until now; anyone with more than a handful of products genuinely needs
// to filter by category, find what's running low, or sort by price.

const inRange = (value, range) => {
  if (!range) return true;
  const min =
    range.min !== undefined && range.min !== "" ? parseFloat(range.min) : null;
  const max =
    range.max !== undefined && range.max !== "" ? parseFloat(range.max) : null;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
};

export const filterService = {
  filterProducts(products, filters = {}, lowStockThreshold = 10) {
    let result = [...products];

    if (filters.category && filters.category !== "all") {
      result = result.filter((p) => p.category === filters.category);
    }

    if (filters.brand && filters.brand !== "all") {
      result = result.filter((p) => p.brand === filters.brand);
    }

    if (filters.stockStatus === "low-stock") {
      result = result.filter(
        (p) => (p.stock || 0) > 0 && (p.stock || 0) <= lowStockThreshold,
      );
    } else if (filters.stockStatus === "out-of-stock") {
      result = result.filter((p) => (p.stock || 0) === 0);
    }

    if (filters.priceRange) {
      result = result.filter((p) =>
        inRange(p.sellingPrice || 0, filters.priceRange),
      );
    }

    if (filters.sortBy === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (filters.sortBy === "price") {
      result.sort((a, b) => (a.sellingPrice || 0) - (b.sellingPrice || 0));
    } else if (filters.sortBy === "stock") {
      result.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    } else if (filters.sortBy === "created") {
      result.sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      );
    }

    if (filters.sortOrder === "desc") {
      result.reverse();
    }

    return result;
  },

  // Distinct, non-empty categories actually present in the current
  // product list — the category filter should only ever offer choices
  // that exist, not a fixed list that may not match reality.
  getCategories(products) {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  },

  // Same reasoning as getCategories — only ever offer brands that
  // actually exist among current products, e.g. distinguishing
  // Kilimanjaro vs Uhai within the same "Water" category.
  getBrands(products) {
    const set = new Set(products.map((p) => p.brand).filter(Boolean));
    return Array.from(set).sort();
  },
};


