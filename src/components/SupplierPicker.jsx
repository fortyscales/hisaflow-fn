import React, { useState } from "react";
import { supplierService } from "../services/supplierservice";
import { useLanguage } from "../context/LanguageContext.jsx";

// Chip-based supplier selection with an inline "add a new one right here"
// option — matches the phone app's pattern exactly. Restocking shouldn't
// ever be blocked on "go create the supplier first, then come back."
const SupplierPicker = ({
  suppliers,
  selectedSupplierId,
  onSelect,
  onSupplierAdded,
}) => {
  const { t } = useLanguage();
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const handleQuickAdd = async () => {
    if (!newName.trim()) {
      setError(t("enterSupplierNameError"));
      return;
    }
    try {
      const result = await supplierService.addSupplier({
        name: newName.trim(),
        phone: "",
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setNewName("");
      setError("");
      setShowNewInput(false);
      onSupplierAdded(result.supplier);
    } catch (err) {
      console.error("Quick add supplier error:", err);
      setError(t("unexpectedErrorTryAgain"));
    }
  };

  return (
    <div>
      <div style={styles.chipRow}>
        <button
          style={{
            ...styles.chip,
            ...(!selectedSupplierId ? styles.chipActive : {}),
          }}
          onClick={() => onSelect(null)}
        >
          {t("noSupplierOption")}
        </button>
        {suppliers.map((s) => (
          <button
            key={s.id}
            style={{
              ...styles.chip,
              ...(selectedSupplierId === s.id ? styles.chipActive : {}),
            }}
            onClick={() => onSelect(s.id)}
          >
            {s.name}
          </button>
        ))}
        <button style={styles.chip} onClick={() => setShowNewInput(true)}>
          {t("addNewOption")}
        </button>
      </div>

      {showNewInput && (
        <div style={styles.newRow}>
          <input
            style={styles.newInput}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("newSupplierNamePlaceholder")}
            autoFocus
            onKeyUp={(e) => e.key === "Enter" && handleQuickAdd()}
          />
          <button style={styles.addBtn} onClick={handleQuickAdd}>
            {t("addLabel")}
          </button>
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
};

const styles = {
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    padding: "7px 13px",
    borderRadius: 999,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 12,
  },
  chipActive: {
    background: "var(--primary)",
    borderColor: "var(--primary)",
    color: "white",
  },
  newRow: { display: "flex", gap: 8, marginTop: 10 },
  newInput: {
    flex: 1,
    padding: "9px 12px",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    background: "var(--bg)",
    color: "var(--text-primary)",
  },
  addBtn: {
    padding: "9px 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 700,
    fontSize: 12,
  },
  error: { fontSize: 11, color: "var(--danger)", marginTop: 6 },
};

export default SupplierPicker;


