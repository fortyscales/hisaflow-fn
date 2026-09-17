import React from "react";

// Every screen previously did `if (loading) return null`, which is a
// blank white flash with no feedback that anything is happening - on a
// slower machine or a larger dataset, that flash lasts long enough to
// look like the screen failed to load at all. One shared component so
// every screen gets the same visual language instead of each one (or
// none of them) inventing its own.
const LoadingState = ({ fullScreen = true, label = "Loading…" }) => (
  <div style={fullScreen ? styles.fullScreenWrap : styles.inlineWrap}>
    <div style={styles.loadingStack}>
      <div style={styles.spinner} />
      <div style={styles.label}>{label}</div>
    </div>
  </div>
);

const styles = {
  fullScreenWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  inlineWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingStack: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" },
  spinner: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "3px solid var(--border-muted, #EBE7E1)",
    borderTopColor: "var(--primary, #5B7F6A)",
    animation: "hf-spin 0.7s linear infinite",
  },
};

export default LoadingState;


