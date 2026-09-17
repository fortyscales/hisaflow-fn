import React, { useState, useEffect, useRef } from "react";
import { dataService } from "../services/DataService";
import { weeklyRecapService } from "../services/weeklyRecapService";
import { useLanguage } from "../context/LanguageContext.jsx";

const WeeklyRecapModal = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const [rendering, setRendering] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setRendering(true);

    (async () => {
      const [sales, creditSales, products, settings] = await Promise.all([
        dataService.getSales(),
        dataService.getCreditSales(),
        dataService.getProducts(),
        dataService.getSettings(),
      ]);

      const { start, end } = weeklyRecapService.getWeekRange();
      const stats = weeklyRecapService.computeStats({
        sales,
        creditSales,
        products,
        start,
        end,
      });

      if (canvasRef.current) {
        await weeklyRecapService.generateRecapCard(canvasRef.current, {
          businessName: settings.businessName,
          stats,
          start,
          end,
        });
      }
      setRendering(false);
    })();
  }, [visible]);

  if (!visible) return null;

  const handleDownload = () => {
    setDownloading(true);
    weeklyRecapService.downloadCanvas(
      canvasRef.current,
      `your-week-${Date.now()}.png`,
    );
    setTimeout(() => setDownloading(false), 400);
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      await weeklyRecapService.copyToClipboard(canvasRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy recap error:", err);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t("weeklyRecapTitle")}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
        </div>

        <div style={styles.previewPane}>
          <canvas
            ref={canvasRef}
            style={{ ...styles.canvas, opacity: rendering ? 0.5 : 1 }}
          />
        </div>

        <div style={styles.actions}>
          <button
            style={styles.copyBtn}
            disabled={rendering || copying}
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
            disabled={rendering || downloading}
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
    background: "rgba(41,37,34,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 55,
  },
  modal: {
    width: 380,
    background: "var(--surface)",
    borderRadius: 20,
    padding: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: 800 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  previewPane: {
    background: "var(--bg)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: { width: "100%", height: "auto", display: "block" },
  actions: { display: "flex", gap: 10 },
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
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 13,
  },
};

export default WeeklyRecapModal;


