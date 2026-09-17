import React, { useMemo, useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { whatsappService } from "../services/whatsappService";
import { useLanguage } from "../context/LanguageContext.jsx";

const formatTZS = (amount) => {
  const v = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "TZS " + Math.round(v).toLocaleString("en-US");
};

// Finds everyone who's actually bought this specific product before —
// customer identity only exists on credit sales (cash checkout never
// captures a name or phone), so that's the only source this can use.
const NotifyPastBuyersModal = ({ visible, product, onClose }) => {
  const { t } = useLanguage();
  const [creditSales, setCreditSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedPhones, setSelectedPhones] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      dataService.getCreditSales().then(setCreditSales);
      dataService.getSettings().then(setSettings);
      setSelectedPhones(new Set());
    }
  }, [visible]);

  const pastBuyers = useMemo(() => {
    if (!product) return [];
    const buyersByPhone = new Map();

    const consider = (name, phone, date) => {
      const normalized = whatsappService.normalizePhone(phone);
      if (!normalized || !name) return;
      const existing = buyersByPhone.get(normalized);
      if (!existing || new Date(date) > new Date(existing.lastPurchaseDate)) {
        buyersByPhone.set(normalized, {
          name,
          phone: normalized,
          lastPurchaseDate: date,
        });
      }
    };

    // Cash sales never capture a customer name or phone — checking out
    // with cash doesn't ask for it. Customer identity only exists on
    // credit sales, so that's the only source worth searching here.
    creditSales.forEach((cs) => {
      const bought = (cs.items || []).some(
        (item) => item.productId === product.id,
      );
      if (bought) consider(cs.customerName, cs.customerPhone, cs.date);
    });

    return Array.from(buyersByPhone.values()).sort(
      (a, b) => new Date(b.lastPurchaseDate) - new Date(a.lastPurchaseDate),
    );
  }, [product, creditSales]);

  const buildDefaultMessage = () => {
    if (!product) return "";
    const shopName = settings.businessName || "HisaFlow";
    return t("restockNotifyMessage", {
      name: "{name}",
      product: product.name,
      price: formatTZS(product.sellingPrice),
      shop: shopName,
    });
  };

  useEffect(() => {
    if (visible && product) setMessage(buildDefaultMessage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product?.id]);

  if (!visible || !product) return null;

  const toggleSelected = (phone) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const handleSendToOne = async (buyer) => {
    setError("");
    try {
      const result = await whatsappService.sendMessage(
        buyer.phone,
        message.replace(/\{name\}/g, buyer.name),
      );
      if (!result.success)
        setError(result.error || t("unexpectedErrorTryAgain"));
      return result;
    } catch (err) {
      console.error("Notify buyer error:", err);
      setError(t("unexpectedErrorTryAgain"));
      return { success: false };
    }
  };

  const handleSendToSelected = async () => {
    if (sending) return; // a second click shouldn't re-send to everyone already in flight
    setError("");
    setSending(true);
    try {
      const selected = pastBuyers.filter((b) => selectedPhones.has(b.phone));
      let failedCount = 0;
      for (const buyer of selected) {
        const result = await handleSendToOne(buyer);
        if (!result.success) failedCount += 1;
      }
      if (failedCount === 0) {
        onClose();
      } else {
        // Some sent, some didn't - stay open so the person can see exactly
        // who's still unselected-but-failed, rather than closing and
        // leaving them to wonder whether everyone actually got the message.
        setError(
          t("someRemindersFailedError", {
            failed: failedCount,
            total: selected.length,
          }),
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={styles.title}>{t("notifyPastBuyersTitle")}</h2>
            <div style={styles.subtitle}>{product.name}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>

        {pastBuyers.length > 0 && (
          <div style={styles.messageSection}>
            <textarea
              style={styles.messageInput}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
            <div style={styles.hint}>{t("nameTokenHint")}</div>
          </div>
        )}

        <div style={styles.list}>
          {pastBuyers.length === 0 ? (
            <div style={styles.emptyNote}>{t("noPastBuyersFound")}</div>
          ) : (
            pastBuyers.map((buyer) => {
              const isSelected = selectedPhones.has(buyer.phone);
              return (
                <div
                  key={buyer.phone}
                  style={{
                    ...styles.row,
                    ...(isSelected ? styles.rowActive : {}),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flex: 1,
                      minWidth: 0,
                    }}
                    onClick={() => toggleSelected(buyer.phone)}
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
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.buyerName}>{buyer.name}</div>
                      <div style={styles.buyerPhone}>{buyer.phone}</div>
                    </div>
                  </div>
                  <button
                    style={styles.sendOneBtn}
                    onClick={() => handleSendToOne(buyer)}
                  >
                    {t("sendLabel")}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {pastBuyers.length > 0 && (
          <>
            {error && <div style={styles.error}>{error}</div>}
            <button
              style={styles.sendAllBtn}
              disabled={selectedPhones.size === 0 || sending}
              onClick={handleSendToSelected}
            >
              {sending
                ? t("completing")
                : t("sendToSelectedCount", { count: selectedPhones.size })}
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
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
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
  messageSection: { marginBottom: 14 },
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
  },
  hint: { fontSize: 10, color: "var(--text-muted)", marginTop: 4 },
  list: { overflow: "auto", marginBottom: 14, flex: 1 },
  emptyNote: {
    fontSize: 13,
    color: "var(--text-muted)",
    padding: "24px 0",
    textAlign: "center",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-muted)",
    marginBottom: 8,
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
  buyerName: {
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  buyerPhone: { fontSize: 11, color: "var(--text-muted)", marginTop: 1 },
  sendOneBtn: {
    padding: "7px 12px",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 11,
    flexShrink: 0,
  },
  sendAllBtn: {
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  },
};

export default NotifyPastBuyersModal;


