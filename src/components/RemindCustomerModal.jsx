import React, { useMemo, useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { whatsappService } from "../services/whatsappService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// The reverse of NotifyPastBuyers: instead of "who bought this product,"
// this asks "what does THIS customer usually buy, and is any of it
// actually in stock right now?" Aggregated across every sale and credit
// sale tied to their phone number — a shop owner would never manually
// cross-reference this at scale.
const RemindCustomerModal = ({
  visible,
  customerName,
  customerPhone,
  onClose,
}) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [creditSales, setCreditSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      dataService.getProducts().then(setProducts);
      dataService.getCreditSales().then(setCreditSales);
      dataService.getSettings().then(setSettings);
    }
  }, [visible]);

  const normalizedPhone = whatsappService.normalizePhone(customerPhone);

  const usualInStockItems = useMemo(() => {
    if (!normalizedPhone) return [];
    const frequencyByProductId = new Map();
    const record = (productId) => {
      if (!productId) return;
      frequencyByProductId.set(
        productId,
        (frequencyByProductId.get(productId) || 0) + 1,
      );
    };

    // Cash sales never capture a customer name or phone — only credit
    // sales reliably identify who bought what.
    creditSales.forEach((cs) => {
      if (
        whatsappService.normalizePhone(cs.customerPhone) === normalizedPhone
      ) {
        (cs.items || []).forEach((item) => record(item.productId));
      }
    });

    const inStockMap = new Map(
      products.filter((p) => (p.stock || 0) > 0).map((p) => [p.id, p]),
    );
    return Array.from(frequencyByProductId.entries())
      .filter(([productId]) => inStockMap.has(productId))
      .sort((a, b) => b[1] - a[1])
      .map(([productId]) => inStockMap.get(productId));
  }, [normalizedPhone, creditSales, products]);

  useEffect(() => {
    if (visible)
      setSelectedProductIds(new Set(usualInStockItems.map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, normalizedPhone]);

  const selectedProducts = usualInStockItems.filter((p) =>
    selectedProductIds.has(p.id),
  );

  useEffect(() => {
    if (visible && selectedProducts.length > 0) {
      const itemsList = selectedProducts
        .map((p) => `${p.name} (${formatTZS(p.sellingPrice)})`)
        .join(", ");
      const shopName = settings.businessName || "HisaFlow";
      setMessage(
        t("remindCustomerMessage", {
          name: customerName || "",
          items: itemsList,
          shop: shopName,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedProducts.length]);

  if (!visible) return null;

  const toggleSelected = (productId) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSend = async () => {
    if (sending) return; // a second click here shouldn't fire the message twice
    setError("");
    setSending(true);
    try {
      const result = await whatsappService.sendMessage(customerPhone, message);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || t("unexpectedErrorTryAgain"));
      }
    } catch (err) {
      console.error("Send reminder error:", err);
      setError(t("unexpectedErrorTryAgain"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={styles.title}>{t("remindCustomerTitle")}</h2>
            <div style={styles.subtitle}>{customerName}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            {t("closeButton")}
          </button>
        </div>

        {usualInStockItems.length === 0 ? (
          <div style={styles.emptyNote}>{t("noUsualItemsInStock")}</div>
        ) : (
          <>
            <div style={styles.hint}>{t("usualItemsHint")}</div>
            <div style={styles.list}>
              {usualInStockItems.map((product) => {
                const isSelected = selectedProductIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    style={{
                      ...styles.row,
                      ...(isSelected ? styles.rowActive : {}),
                    }}
                    onClick={() => toggleSelected(product.id)}
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
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.itemName}>{product.name}</div>
                      <div style={styles.itemPrice}>
                        {formatTZS(product.sellingPrice)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedProducts.length > 0 && (
              <textarea
                style={styles.messageInput}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            )}

            {error && <div style={styles.error}>{error}</div>}

            <button
              style={styles.sendBtn}
              disabled={selectedProducts.length === 0 || sending}
              onClick={handleSend}
            >
              {sending ? t("completing") : t("sendReminderButton")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  error: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 14,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(41,37,34,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
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
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: 800 },
  subtitle: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "var(--text-secondary)",
  },
  emptyNote: {
    fontSize: 13,
    color: "var(--text-muted)",
    padding: "24px 0",
    textAlign: "center",
  },
  hint: { fontSize: 12, color: "var(--text-muted)", marginBottom: 12 },
  list: { marginBottom: 14 },
  row: {
    display: "flex",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-muted)",
    marginBottom: 8,
    cursor: "pointer",
  },
  rowActive: {
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
    marginRight: 10,
    background: "var(--surface)",
  },
  checkboxActive: {
    background: "var(--primary)",
    borderColor: "var(--primary)",
  },
  itemName: { fontSize: 13, fontWeight: 700 },
  itemPrice: { fontSize: 11, color: "var(--text-muted)", marginTop: 1 },
  messageInput: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    background: "var(--bg)",
    color: "var(--text-primary)",
    resize: "none",
    fontFamily: "inherit",
    marginBottom: 14,
  },
  sendBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default RemindCustomerModal;


