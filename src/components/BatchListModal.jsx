import React from "react";
import { batchService } from "../services/batchService";
import BatchCard from "./BatchCard.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Lists every stock batch for a product, oldest first — the exact order
// consumeStock will actually sell from. Answers the question a running
// average can't: "why does this product's average cost look the way it
// does, and which delivery am I actually selling from right now?"
const BatchListModal = ({ visible, product, onClose }) => {
  const { t } = useLanguage();

  if (!visible || !product) return null;

  const migrated = batchService.migrateProduct(product);
  const sortedBatches = [...(migrated.stockBatches || [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  const activeBatches = sortedBatches.filter((b) => b.remaining > 0);
  const oldestActiveId = activeBatches[0]?.id;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={styles.title}>{t("stockBatchesTitle")}</h2>
            <div style={styles.subtitle}>{product.name}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("cancelButton")}
          </button>
        </div>

        <div style={styles.summaryRow}>
          <div style={styles.summaryBox}>
            <div style={styles.summaryLabel}>{t("totalStockLabel")}</div>
            <div style={styles.summaryValue}>
              {batchService.getTotalStock(sortedBatches)}
            </div>
          </div>
          <div style={styles.summaryBox}>
            <div style={styles.summaryLabel}>{t("averagePriceLabel")}</div>
            <div style={styles.summaryValue}>
              {formatTZS(batchService.getWeightedAverage(sortedBatches))}
            </div>
          </div>
          <div style={styles.summaryBox}>
            <div style={styles.summaryLabel}>{t("activeBatchesLabel")}</div>
            <div style={styles.summaryValue}>{activeBatches.length}</div>
          </div>
        </div>

        <div style={styles.list}>
          {sortedBatches.length === 0 ? (
            <div style={styles.emptyNote}>{t("noBatchesYet")}</div>
          ) : (
            sortedBatches.map((batch, idx) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                index={idx}
                isOldestActive={batch.id === oldestActiveId}
              />
            ))
          )}
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
    width: 440,
    maxHeight: "85vh",
    overflow: "auto",
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: 800 },
  subtitle: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  summaryRow: { display: "flex", gap: 10, marginBottom: 18 },
  summaryBox: {
    flex: 1,
    background: "var(--bg)",
    borderRadius: 14,
    padding: "12px 10px",
    textAlign: "center",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: 4,
  },
  summaryValue: { fontSize: 14, fontWeight: 800 },
  list: { marginBottom: 14 },
  emptyNote: {
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "24px 0",
  },
};

export default BatchListModal;


