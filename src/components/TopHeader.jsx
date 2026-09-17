import React, { useState, useEffect } from "react";
import { dataService } from "../services/DataService";
import { alertService } from "../services/alertService.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Bell } from "lucide-react";

// Spans the full width of the app, above both the sidebar and the main
// content - matches the mockup's top bar exactly, rather than only
// spanning the content area next to a separately-topped sidebar. The
// logo section on the left is given the same fixed width as the
// sidebar itself so the two visually align as one continuous shell.
const TopHeader = ({ currentUser, businessName }) => {
  const { t } = useLanguage();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    dataService.getProducts().then((products) => {
      const low = alertService.getLowStockAlerts(products).total;
      const expiry = alertService.getExpiryAlerts(products);
      setAlertCount(low + expiry.expired.length + expiry.expiringSoon.length);
    });
  }, []);

  const initials = (currentUser?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={styles.header}>
      <div style={styles.brandRow}>
        <div style={styles.brandMark}>H</div>
        <div style={styles.brandName}>{businessName || "HisaFlow"}</div>
      </div>
      <div style={styles.tagline}>{t("appTagline")}</div>
      <div style={styles.right}>
        <div style={styles.bellWrap}>
          <Bell size={19} color="var(--sidebar-text)" style={styles.bellIcon} />
          {alertCount > 0 && (
            <span style={styles.bellBadge}>
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </div>
        <div style={styles.avatar}>{initials}</div>
        <div>
          <div style={styles.userName}>{currentUser?.name}</div>
          <div style={styles.userRole}>
            {currentUser?.isOwner ? t("ownerRoleLabel") : t("staffRoleLabel")}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  header: {
    height: 64,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: "0 24px 0 0",
    background: "var(--sidebar-bg)",
  },
  brandRow: {
    width: 220,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    boxSizing: "border-box",
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    background: "var(--sidebar-bg-active)",
    color: "var(--sidebar-active-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--sidebar-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tagline: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--sidebar-text-muted)",
  },
  right: { display: "flex", alignItems: "center", gap: 14 },
  bellWrap: { position: "relative", fontSize: 18, lineHeight: 1 },
  bellIcon: { display: "block" },
  bellBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    background: "var(--danger)",
    color: "white",
    fontSize: 9,
    fontWeight: 800,
    borderRadius: 999,
    padding: "1px 5px",
    minWidth: 14,
    textAlign: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "var(--sidebar-bg-active)",
    color: "var(--sidebar-active-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
  },
  userName: { fontSize: 12, fontWeight: 700, color: "var(--sidebar-text)" },
  userRole: { fontSize: 10, color: "var(--sidebar-text-muted)" },
};

export default TopHeader;


