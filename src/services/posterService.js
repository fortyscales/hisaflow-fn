// Draws a real poster directly onto an HTML canvas — no external library,
// Canvas is a native browser API and Electron's renderer is a real
// browser. Two layouts, same idea as the phone app: one product gets a
// full hero treatment (the photo IS the ad), several products get a grid
// where each still gets real room, not a thin list row.

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1000; // 4:5, matches Instagram's post ratio

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Draws an image cropped to fill a target box exactly (like CSS
// object-fit: cover) — canvas has no built-in "cover" mode, so this does
// the aspect-ratio math by hand.
const drawImageCover = (ctx, img, x, y, w, h) => {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

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

const drawBrandBadge = (ctx, businessName, logoImg, x, y) => {
  const padding = 10;
  const logoSize = 32;
  ctx.font = "700 18px -apple-system, sans-serif";
  const textWidth = ctx.measureText(businessName).width;
  const badgeWidth = logoSize + padding * 2 + textWidth + 10;
  const badgeHeight = logoSize + padding;

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, x, y, badgeWidth, badgeHeight, badgeHeight / 2);
  ctx.fill();

  if (logoImg) {
    ctx.save();
    roundRect(ctx, x + padding / 2, y + padding / 2, logoSize, logoSize, 8);
    ctx.clip();
    drawImageCover(
      ctx,
      logoImg,
      x + padding / 2,
      y + padding / 2,
      logoSize,
      logoSize,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "#EDF3EE";
    roundRect(ctx, x + padding / 2, y + padding / 2, logoSize, logoSize, 8);
    ctx.fill();
    ctx.font = "16px sans-serif";
    ctx.fillText("🛍️", x + padding / 2 + 7, y + padding / 2 + 23);
  }

  ctx.fillStyle = "#292524";
  ctx.font = "700 15px -apple-system, sans-serif";
  ctx.fillText(businessName, x + padding + logoSize, y + badgeHeight / 2 + 5);

  return badgeHeight;
};

export const posterService = {
  async generateHeroPoster(canvas, product, photoUri, businessName, logoUri) {
    const ctx = canvas.getContext("2d");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    if (photoUri) {
      const img = await loadImage(photoUri);
      drawImageCover(ctx, img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      ctx.fillStyle = "#5B7F6A";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = "160px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🛍️", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      ctx.textAlign = "left";
    }

    const logoImg = logoUri ? await loadImage(logoUri) : null;
    drawBrandBadge(ctx, businessName || "HisaFlow", logoImg, 24, 24);

    const barHeight = 170;
    const barY = CANVAS_HEIGHT - barHeight;
    ctx.fillStyle = "rgba(30,26,22,0.72)";
    ctx.fillRect(0, barY, CANVAS_WIDTH, barHeight);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 34px -apple-system, sans-serif";
    ctx.fillText(product.name, 32, barY + 55, CANVAS_WIDTH - 64);

    const priceText = formatTZS(product.sellingPrice);
    ctx.font = "800 26px -apple-system, sans-serif";
    const priceWidth = ctx.measureText(priceText).width;
    ctx.fillStyle = "#D99B3F";
    roundRect(ctx, 32, barY + 80, priceWidth + 44, 48, 24);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(priceText, 54, barY + 112);
  },

  async generateGridPoster(canvas, products, photoUris, businessName, logoUri) {
    const ctx = canvas.getContext("2d");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    ctx.fillStyle = "#FAF9F7";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const logoImg = logoUri ? await loadImage(logoUri) : null;
    drawBrandBadge(ctx, businessName || "HisaFlow", logoImg, 24, 24);

    const gridTop = 90;
    const cols = 2;
    const gap = 12;
    const cellW = (CANVAS_WIDTH - gap * (cols + 1)) / cols;
    const rows = Math.ceil(products.length / cols);
    const cellH = Math.min(
      280,
      (CANVAS_HEIGHT - gridTop - gap * (rows + 1)) / rows,
    );

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gap + col * (cellW + gap);
      const y = gridTop + gap + row * (cellH + gap);

      ctx.save();
      roundRect(ctx, x, y, cellW, cellH, 14);
      ctx.clip();

      const photoUri = photoUris[product.id];
      if (photoUri) {
        const img = await loadImage(photoUri);
        drawImageCover(ctx, img, x, y, cellW, cellH);
      } else {
        ctx.fillStyle = "#5B7F6A";
        ctx.fillRect(x, y, cellW, cellH);
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🛍️", x + cellW / 2, y + cellH / 2 + 16);
        ctx.textAlign = "left";
      }

      const labelH = 52;
      ctx.fillStyle = "rgba(30,26,22,0.72)";
      ctx.fillRect(x, y + cellH - labelH, cellW, labelH);
      ctx.restore();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 14px -apple-system, sans-serif";
      ctx.fillText(product.name, x + 12, y + cellH - 28, cellW - 24);
      ctx.fillStyle = "#F2D9A8";
      ctx.font = "800 15px -apple-system, sans-serif";
      ctx.fillText(
        formatTZS(product.sellingPrice),
        x + 12,
        y + cellH - 10,
        cellW - 24,
      );
    }
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

  // Copies the poster straight to the OS clipboard — paste directly into
  // WhatsApp, Facebook, Instagram's web composer, wherever, without
  // downloading a file first and attaching it manually.
  async copyToClipboard(canvas) {
    const dataUrl = canvas.toDataURL("image/png");
    await window.hisaflow.copyImageToClipboard(dataUrl);
  },
};


