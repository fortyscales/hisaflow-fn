import React from "react";
import { Search } from "lucide-react";

const SearchInput = ({ value, onChange, placeholder, style }) => (
  <div style={{ ...styles.wrap, ...style }}>
    <Search size={15} style={styles.icon} />
    <input
      style={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const styles = {
  wrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    marginBottom: 14,
  },
  icon: {
    position: "absolute",
    left: 13,
    color: "var(--text-muted)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "11px 14px 11px 36px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    background: "var(--surface)",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  },
};

export default SearchInput;


