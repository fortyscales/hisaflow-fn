import React from "react";

// One shared header instead of every screen's own bare <h1> with no
// icon, no subtitle, and no visual weight. The icon badge and subtitle
// give each screen an identity at a glance and a one-line explanation
// of what it's actually for - useful for a new staff member who's
// never seen the app, not just decoration.
const ScreenHeader = ({
  Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
  embedded = false,
  inset = 28,
}) => (
  <div style={{ ...styles.header, ...(!embedded ? { top: -inset, marginTop: -inset, marginLeft: -inset, marginRight: -inset, padding: `${inset}px ${inset + 2}px 13px` } : styles.embedded) }}>
    <div style={styles.left}>
      {Icon && (
        <div style={styles.iconBadge}>
          <Icon size={22} color="var(--primary-dark)" />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      </div>
    </div>
    {children
      ? children
      : actionLabel &&
        onAction && (
          <button style={styles.actionBtn} onClick={onAction}>
            {actionLabel}
          </button>
        )}
  </div>
);

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    gap: 16,
    position: "sticky",
    top: 0,
    zIndex: 20,
    padding: "14px 2px 13px",
    background: "color-mix(in srgb, var(--bg) 96%, transparent)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid var(--border-muted)",
    boxShadow: "0 6px 16px color-mix(in srgb, var(--bg) 82%, transparent)",
  },
  embedded: { position: "static", top: "auto", marginBottom: 12, padding: "0 2px 12px", boxShadow: "none", backdropFilter: "none" },
  left: { display: "flex", alignItems: "center", gap: 14, minWidth: 0 },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "var(--primary-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 21,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  subtitle: { fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 },
  actionBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
};

export default ScreenHeader;


