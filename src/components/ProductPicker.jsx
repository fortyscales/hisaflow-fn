import React, { useState, useRef, useEffect } from "react";
import { searchService } from "../services/searchService";
import { Search, X } from "lucide-react";
import ProductIdentity from "./ProductIdentity.jsx";

const MAX_RESULTS = 8;

// A plain <select> listing every product breaks down once a shop has
// hundreds of them - the browser renders a dropdown hundreds of items
// tall, and finding one specific product means scrolling through all
// of them in whatever order they happen to be in. This searches as you
// type (name/category/brand, same matching searchService already uses
// elsewhere) and only ever renders a handful of results at once,
// regardless of how large the underlying product list is.
const ProductPicker = ({
  products,
  value,
  onChange,
  placeholder,
  renderOption,
  noResultsMessage,
  refineHint,
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = products.find((p) => p.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const results = query.trim()
    ? searchService.searchProducts(products, query).slice(0, MAX_RESULTS)
    : products.slice(0, MAX_RESULTS);

  const handleSelect = (product) => {
    onChange(product.id);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
  };

  return (
    <div style={styles.wrap} ref={wrapRef}>
      {selected ? (
        <div style={styles.selectedRow}>
          <span style={styles.selectedName}>
            {renderOption ? renderOption(selected) : <ProductIdentity product={selected} compact showStock />}
          </span>
          <button type="button" style={styles.clearBtn} onClick={handleClear}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={styles.inputWrap}>
          <Search size={15} style={styles.searchIcon} />
          <input
            style={styles.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
          />
        </div>
      )}

      {open && !selected && (
        <div style={styles.dropdown}>
          {results.length === 0 ? (
            <div style={styles.emptyMessage}>{noResultsMessage}</div>
          ) : (
            results.map((p) => (
              <button
                type="button"
                key={p.id}
                style={styles.option}
                onClick={() => handleSelect(p)}
              >
                {renderOption ? renderOption(p) : <ProductIdentity product={p} compact showStock />}
              </button>
            ))
          )}
          {results.length === MAX_RESULTS && (
            <div style={styles.moreHint}>{refineHint}</div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  wrap: { position: "relative" },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 13,
    color: "var(--text-muted)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "11px 13px 11px 36px",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--bg)",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  },
  selectedRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    border: "1.5px solid var(--primary)",
    borderRadius: 12,
    background: "var(--primary-light)",
  },
  selectedName: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--primary-dark)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "none",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    zIndex: 40,
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(16,32,28,0.12)",
    maxHeight: 260,
    overflow: "auto",
    padding: 6,
  },
  option: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 13,
    fontWeight: 600,
  },
  emptyMessage: {
    padding: "12px 10px",
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "center",
  },
  moreHint: {
    padding: "8px 10px 4px",
    fontSize: 11,
    color: "var(--text-muted)",
    textAlign: "center",
  },
};

export default ProductPicker;


