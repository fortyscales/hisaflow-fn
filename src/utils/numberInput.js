// A plain <input type="number"> silently accepts 'e' (for scientific
// notation, e.g. typing "1e5" becomes 100000), plus '+' and '-' — none
// of which make sense for a price or quantity field in this app.
// Attach this to onKeyDown on any number input to block them at the
// keystroke, rather than trying to clean up an already-typed value.
export const blockInvalidNumberKeys = (e) => {
  if (["e", "E", "+", "-"].includes(e.key)) {
    e.preventDefault();
  }
};


