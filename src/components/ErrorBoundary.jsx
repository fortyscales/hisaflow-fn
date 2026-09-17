import React from "react";
import { crashLogService } from "../services/crashLogService";

// Must be a class component - componentDidCatch has no hook equivalent.
// Without this, any unexpected render error (a null pointer from a
// malformed record, a missing field on old data) unmounts the entire
// React tree and leaves a blank white window with no way back except
// force-quitting the app. This is the last line of defense specifically
// for RENDER-time errors - crashLogService.installGlobalHandlers()
// already covers uncaught exceptions and unhandled promise rejections
// elsewhere, but neither of those catches a component throwing during
// render itself.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    crashLogService.logError(error?.message || String(error), {
      stack: error?.stack,
      context: `render-error${info?.componentStack ? `: ${info.componentStack.slice(0, 300)}` : ""}`,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Hardcoded text, not useLanguage() - this boundary wraps the
      // LanguageProvider itself (see main.jsx), so if the render error
      // originated inside that provider or anything using its context,
      // that context can't be trusted to still work correctly here.
      // Swahili as the default, matching the app's primary user base.
      return (
        <div style={styles.wrap}>
          <div style={styles.card}>
            <div style={styles.title}>Hitilafu imetokea</div>
            <div style={styles.body}>
              Jambo fulani halikwenda sawa. Taarifa ya hitilafu imehifadhiwa
              kiotomatiki — unaweza kuipata Settings &gt; Crash Log ukihitaji
              kumtumia msanidi programu.
            </div>
            <button style={styles.button} onClick={this.handleReload}>
              Anzisha Upya
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  wrap: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg, #FAF9F7)",
    zIndex: 9999,
  },
  card: {
    maxWidth: 380,
    padding: 32,
    borderRadius: 20,
    background: "var(--surface, #FFFFFF)",
    border: "1px solid var(--border-muted, #EBE7E1)",
    textAlign: "center",
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 10 },
  body: {
    fontSize: 13,
    color: "var(--text-secondary, #6B6558)",
    lineHeight: 1.6,
    marginBottom: 22,
  },
  button: {
    padding: "12px 24px",
    borderRadius: 12,
    border: "none",
    background: "var(--primary, #5B7F6A)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
  },
};

export default ErrorBoundary;


