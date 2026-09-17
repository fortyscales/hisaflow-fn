import React from "react";

// Pins screen-level controls to the very top edge of the scrolling pane.
// The negative inset cancels the screen's normal top padding so rows/cards can
// never become visible in the strip above the toolbar while scrolling.
const StickyScreenChrome = ({ children, inset = 28, style }) => (
  <div
    style={{
      position: "sticky",
      top: -inset,
      zIndex: 35,
      marginTop: -inset,
      marginLeft: -inset,
      marginRight: -inset,
      padding: `${inset}px ${inset}px 12px`,
      marginBottom: 16,
      background: "var(--bg)",
      borderBottom: "1px solid var(--border-muted)",
      boxShadow: "0 8px 18px color-mix(in srgb, var(--bg) 84%, transparent)",
      ...style,
    }}
  >
    {children}
  </div>
);

export default StickyScreenChrome;
