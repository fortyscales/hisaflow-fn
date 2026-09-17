import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

// Client-side pagination on an already-filtered, already-sorted list.
// A genuine SQL LIMIT/OFFSET approach would need the search and filter
// logic to live in SQL too — otherwise "page 2 of these search results"
// can't be answered correctly without the database applying both
// together. For this app's realistic data volumes (a shop's full sales
// history is comfortably a few thousand rows, not millions), paginating
// what's already loaded is the right-sized fix for the real problem:
// a screen turning into one giant unwieldy list.
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  return (
    <div style={styles.wrap}>
      <button
        style={{ ...styles.navBtn, opacity: currentPage === 1 ? 0.4 : 1 }}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ‹
      </button>
      <span style={styles.indicator}>
        {t("pageIndicator", { current: currentPage, total: totalPages })}
      </span>
      <button
        style={{
          ...styles.navBtn,
          opacity: currentPage === totalPages ? 0.4 : 1,
        }}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        ›
      </button>
    </div>
  );
};

const styles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: "20px 0",
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text-primary)",
    fontSize: 18,
    fontWeight: 700,
  },
  indicator: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    minWidth: 100,
    textAlign: "center",
  },
};

export default Pagination;


