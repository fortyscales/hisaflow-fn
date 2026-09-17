import React, { useState, useEffect, useRef } from "react";
import { dataService } from "../services/DataService";
import { posterService } from "../services/posterService";
import { analyticsService } from "../services/analyticsService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

const PosterModal = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [mode, setMode] = useState("popular"); // 'popular' | 'allInStock' — starting point for selection
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [rendering, setRendering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (visible) {
      dataService
        .getProducts()
        .then((data) => setProducts(data.filter((p) => (p.stock || 0) > 0)));
      dataService.getSales().then(setSales);
      dataService.getSettings().then(setSettings);
      setMode("popular");
    }
  }, [visible]);

  const popularProducts = analyticsService
    .getBestSellers(products, sales, 8)
    .map((entry) => entry.product);
  const candidates =
    mode === "popular" && popularProducts.length > 0
      ? popularProducts
      : products;

  useEffect(() => {
    if (!visible) return;
    if (mode === "popular" && popularProducts.length > 0) {
      setSelectedIds(new Set(popularProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, visible, products, sales]);

  const selectedProducts = candidates.filter((p) => selectedIds.has(p.id));

  useEffect(() => {
    if (!visible || selectedProducts.length === 0 || !canvasRef.current) return;
    setRendering(true);
    const render = async () => {
      try {
        if (selectedProducts.length === 1) {
          await posterService.generateHeroPoster(
            canvasRef.current,
            selectedProducts[0],
            selectedProducts[0].imageUri,
            settings.businessName,
            settings.businessLogo,
          );
        } else {
          const photoUris = {};
          selectedProducts.forEach((p) => {
            photoUris[p.id] = p.imageUri;
          });
          await posterService.generateGridPoster(
            canvasRef.current,
            selectedProducts.slice(0, 6), // keep the grid legible — six is plenty for one poster
            photoUris,
            settings.businessName,
            settings.businessLogo,
          );
        }
      } catch (err) {
        console.error("Poster render error:", err);
      } finally {
        setRendering(false);
      }
    };
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, visible]);

  if (!visible) return null;

  const toggleSelected = (productId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleDownload = () => {
    setDownloading(true);
    const businessName = (settings.businessName || "HisaFlow").replace(
      /[^a-zA-Z0-9]/g,
      "_",
    );
    posterService.downloadCanvas(
      canvasRef.current,
      `${businessName}_poster_${Date.now()}.png`,
    );
    setTimeout(() => setDownloading(false), 400);
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      await posterService.copyToClipboard(canvasRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy poster error:", err);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("createPosterTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.selectPane}>
            <div style={styles.modeRow}>
              <button
                style={{
                  ...styles.modeBtn,
                  ...(mode === "popular" ? styles.modeBtnActive : {}),
                }}
                onClick={() => setMode("popular")}
              >
                {t("bestSellersOption")}
              </button>
              <button
                style={{
                  ...styles.modeBtn,
                  ...(mode === "allInStock" ? styles.modeBtnActive : {}),
                }}
                onClick={() => setMode("allInStock")}
              >
                {t("allInStockOption")}
              </button>
            </div>

            <div style={styles.hint}>{t("selectProductsForPosterHint")}</div>
            <div style={styles.productList}>
              {candidates.length === 0 ? (
                <div style={styles.emptyNote}>{t("noProductsToShare")}</div>
              ) : (
                candidates.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelected(p.id)}
                      style={{
                        ...styles.productRow,
                        ...(isSelected ? styles.productRowActive : {}),
                      }}
                    >
                      <div
                        style={{
                          ...styles.checkbox,
                          ...(isSelected ? styles.checkboxActive : {}),
                        }}
                      >
                        {isSelected && (
                          <span
                            style={{
                              color: "white",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      {p.imageUri ? (
                        <img src={p.imageUri} alt="" style={styles.thumb} />
                      ) : (
                        <div style={styles.thumbFallback}>
                          {(p.name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.productName}>{p.name}</div>
                        <div style={styles.productPrice}>
                          {formatTZS(p.sellingPrice)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={styles.previewPane}>
            {selectedProducts.length === 0 ? (
              <div style={styles.previewEmpty}>
                {t("pickProductsToPreviewHint")}
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                style={{ ...styles.canvas, opacity: rendering ? 0.5 : 1 }}
              />
            )}
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
          <button
            style={styles.copyBtn}
            disabled={selectedProducts.length === 0 || rendering || copying}
            onClick={handleCopy}
          >
            {copying
              ? t("completing")
              : copied
                ? t("copiedLabel")
                : t("copyToClipboardButton")}
          </button>
          <button
            style={styles.downloadBtn}
            disabled={selectedProducts.length === 0 || rendering || downloading}
            onClick={handleDownload}
          >
            {downloading ? t("completing") : t("downloadPosterButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  modal: {
    width: 720,
    maxHeight: "88vh",
    background: "var(--surface)",
    borderRadius: 22,
    padding: 24,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 800 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "var(--text-secondary)",
  },
  body: {
    display: "flex",
    gap: 18,
    flex: 1,
    overflow: "hidden",
    minHeight: 380,
  },
  selectPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  modeRow: { display: "flex", gap: 8, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12,
  },
  modeBtnActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
    color: "var(--primary-dark)",
  },
  hint: { fontSize: 12, color: "var(--text-muted)", marginBottom: 10 },
  productList: { flex: 1, overflow: "auto" },
  emptyNote: {
    fontSize: 13,
    color: "var(--text-muted)",
    padding: "20px 0",
    textAlign: "center",
  },
  productRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-muted)",
    marginBottom: 8,
    cursor: "pointer",
  },
  productRowActive: {
    background: "var(--primary-light)",
    borderColor: "var(--primary)",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "var(--surface)",
  },
  checkboxActive: {
    background: "var(--primary)",
    borderColor: "var(--primary)",
  },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
  },
  thumbFallback: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: "var(--primary-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--primary-dark)",
    flexShrink: 0,
  },
  productName: {
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  productPrice: { fontSize: 11, color: "var(--text-muted)", marginTop: 1 },
  previewPane: {
    width: 240,
    flexShrink: 0,
    background: "var(--bg)",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewEmpty: {
    textAlign: "center",
    fontSize: 12,
    color: "var(--text-muted)",
    padding: 20,
  },
  canvas: { width: "100%", height: "auto", display: "block" },
  actions: { display: "flex", gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 14,
  },
  copyBtn: {
    flex: 2,
    padding: 13,
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  downloadBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
};

export default PosterModal;


