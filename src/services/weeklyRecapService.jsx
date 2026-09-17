// A shareable "your week" summary card — reuses the exact canvas
// approach already proven in posterService (native Canvas API, no
// library needed), just with different content: a performance snapshot
// instead of a product ad. Not ported from the phone app — I checked
// the actual source and found only a translation key for the title with
// no matching implementation, so this is designed fresh, reusing what's
// already built and verified rather than guessing at something unproven.

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1000;

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const formatDateShort = (date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const weeklyRecapService = {
  getWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  },

  computeStats({ sales, creditSales, products, start, end }) {
    const inRange = (dateString) => {
      const d = new Date(dateString);
      return d >= start && d <= end;
    };

    const weekSales = sales.filter((s) => inRange(s.date));
    const weekCreditSales = creditSales.filter((cs) => inRange(cs.date));
    const weekCreditItems = weekCreditSales.flatMap((cs) => cs.items || []);

    const totalRevenue =
      weekSales.reduce((sum, s) => sum + (s.totalRevenue || 0), 0) +
      weekCreditSales.reduce((sum, cs) => sum + (cs.totalAmount || 0), 0);
    const totalProfit =
      weekSales.reduce((sum, s) => sum + (s.profit || 0), 0) +
      weekCreditItems.reduce(
        (sum, item) =>
          sum + (item.sellingPrice - (item.costAtSale || 0)) * item.quantity,
        0,
      );
    const transactionCount = weekSales.length + weekCreditSales.length;

    const quantityByProduct = {};
    weekSales.forEach((s) => {
      quantityByProduct[s.productId] =
        (quantityByProduct[s.productId] || 0) + (s.quantity || 0);
    });
    weekCreditItems.forEach((item) => {
      quantityByProduct[item.productId] =
        (quantityByProduct[item.productId] || 0) + (item.quantity || 0);
    });

    const bestSellerId = Object.entries(quantityByProduct).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    const bestSeller = bestSellerId
      ? products.find((p) => p.id === bestSellerId)
      : null;

    return { totalRevenue, totalProfit, transactionCount, bestSeller };
  },

  async generateRecapCard(canvas, { businessName, stats, start, end }) {
    const ctx = canvas.getContext("2d");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#43614F");
    gradient.addColorStop(1, "#2A3F32");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Header
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 20px -apple-system, sans-serif";
    ctx.fillText(businessName || "HisaFlow", 48, 80);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 52px -apple-system, sans-serif";
    ctx.fillText("Your Week", 48, 150);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "500 18px -apple-system, sans-serif";
    ctx.fillText(
      `${formatDateShort(start)} - ${formatDateShort(end)}`,
      48,
      182,
    );

    // Main stat card — revenue, the headline number
    const cardX = 48;
    const cardW = CANVAS_WIDTH - 96;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, cardX, 230, cardW, 180, 24);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "600 16px -apple-system, sans-serif";
    ctx.fillText("TOTAL REVENUE", cardX + 32, 280);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 48px -apple-system, sans-serif";
    ctx.fillText(formatTZS(stats.totalRevenue), cardX + 32, 340);

    // Secondary stats row — profit and transaction count side by side
    const secondaryY = 450;
    const secondaryH = 150;
    const gap = 16;
    const secondaryW = (cardW - gap) / 2;

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, cardX, secondaryY, secondaryW, secondaryH, 20);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "600 14px -apple-system, sans-serif";
    ctx.fillText("PROFIT", cardX + 24, secondaryY + 40);
    ctx.fillStyle = "#F2D9A8";
    ctx.font = "800 30px -apple-system, sans-serif";
    ctx.fillText(
      formatTZS(stats.totalProfit),
      cardX + 24,
      secondaryY + 85,
      secondaryW - 48,
    );

    const rightX = cardX + secondaryW + gap;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, rightX, secondaryY, secondaryW, secondaryH, 20);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "600 14px -apple-system, sans-serif";
    ctx.fillText("SALES", rightX + 24, secondaryY + 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 30px -apple-system, sans-serif";
    ctx.fillText(String(stats.transactionCount), rightX + 24, secondaryY + 85);

    // Best seller card
    if (stats.bestSeller) {
      const bsY = secondaryY + secondaryH + gap;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(ctx, cardX, bsY, cardW, 130, 20);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("BEST SELLER", cardX + 24, bsY + 38);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 26px -apple-system, sans-serif";
      ctx.fillText(stats.bestSeller.name, cardX + 24, bsY + 78, cardW - 48);
    }

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 15px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HisaFlow", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
    ctx.textAlign = "left";
  },

  downloadCanvas(canvas, fileName) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  },

  async copyToClipboard(canvas) {
    const dataUrl = canvas.toDataURL("image/png");
    await window.hisaflow.copyImageToClipboard(dataUrl);
  },
};


