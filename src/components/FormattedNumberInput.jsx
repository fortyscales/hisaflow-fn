import React, { useRef, useLayoutEffect } from "react";

// type="number" inputs cannot display commas at all - the browser
// rejects non-numeric characters outright. This uses type="text" with
// inputMode="decimal" instead, and manually re-inserts commas on every
// keystroke while keeping the cursor exactly where the person was
// typing - not jumping to the end, which is the most common way a
// naive version of this breaks. The underlying value passed to
// onChange is always the plain numeric string with no commas, so
// existing parseFloat/parseInt calls elsewhere don't need to change.

const toRawDigits = (str) => {
  let seenDot = false;
  let out = "";
  for (const ch of str) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !seenDot) {
      out += ch;
      seenDot = true;
    }
  }
  return out;
};

const formatWithCommas = (raw) => {
  if (raw === "" || raw === ".") return raw;
  const [intPart, ...rest] = raw.split(".");
  const decPart = rest.length > 0 ? "." + rest.join("") : "";
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return withCommas + decPart;
};

// Counts digits (ignoring commas) up to the cursor in the pre-reformat
// native value, then finds that same digit count into the newly
// formatted string - this is what keeps the cursor sitting right after
// whatever the person just typed, whether that's at the end, in the
// middle, or right next to a comma.
const computeNewCursorPos = (nativeValue, nativeCursor, newFormatted) => {
  const digitsBeforeCursor = toRawDigits(
    nativeValue.slice(0, nativeCursor),
  ).length;
  let seen = 0;
  for (let i = 0; i < newFormatted.length; i++) {
    const ch = newFormatted[i];
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      seen++;
      if (seen === digitsBeforeCursor) return i + 1;
    }
  }
  return newFormatted.length;
};

const FormattedNumberInput = ({
  value,
  onChange,
  style,
  placeholder,
  autoFocus,
  allowDecimal = true,
  disabled = false,
  onBlur,
  onKeyDown,
}) => {
  const inputRef = useRef(null);
  const pendingCursorRef = useRef(null);

  const displayValue = formatWithCommas(String(value ?? ""));

  // Restores the cursor position after React re-renders with the newly
  // formatted value - a plain onChange can't do this synchronously
  // since the DOM hasn't updated with the new value yet at that point.
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(
        pendingCursorRef.current,
        pendingCursorRef.current,
      );
      pendingCursorRef.current = null;
    }
  });

  const handleChange = (e) => {
    const nativeValue = e.target.value;
    const nativeCursor = e.target.selectionStart ?? nativeValue.length;
    let raw = toRawDigits(nativeValue);
    if (!allowDecimal) raw = raw.replace(".", "");
    const formatted = formatWithCommas(raw);
    pendingCursorRef.current = computeNewCursorPos(
      nativeValue,
      nativeCursor,
      formatted,
    );
    onChange(raw);
  };

  const handleKeyDown = (e) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      style={style}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
    />
  );
};

export default FormattedNumberInput;


