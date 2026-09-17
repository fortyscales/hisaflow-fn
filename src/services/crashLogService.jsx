import { dataService } from "./DataService";

const MAX_ENTRIES = 200;
let installed = false;

export const crashLogService = {
  async logError(message, extra = {}) {
    try {
      const entry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        timestamp: new Date().toISOString(),
        message: String(message).slice(0, 2000),
        stack: extra.stack ? String(extra.stack).slice(0, 4000) : "",
        context: extra.context || "",
      };
      await dataService.appendCrashLog(entry);
    } catch (err) {
      // Logging must never itself be the thing that breaks the app —
      // swallow silently rather than throw from inside error handling.
    }
  },

  async getLogs() {
    return dataService.getCrashLog();
  },

  async clearLogs() {
    await dataService.clearCrashLog();
  },

  // Downloads the log as a plain text file to send to a developer —
  // same download-via-blob pattern used everywhere else in this app,
  // not a native file-share sheet (desktop has no equivalent).
  async exportLogs() {
    const log = await dataService.getCrashLog();
    if (log.length === 0) {
      return { success: false, error: "Hakuna hitilafu zilizorekodiwa" };
    }

    const textContent = log
      .map(
        (e) =>
          `[${e.timestamp}]\n${e.message}${e.context ? `\nMahali: ${e.context}` : ""}${e.stack ? `\n${e.stack}` : ""}\n${"—".repeat(20)}`,
      )
      .join("\n\n");

    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hisaflow-crash-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true };
  },

  // Two lightweight, app-wide safety nets — call once, as early as
  // possible (App.jsx, outside any component's render path).
  installGlobalHandlers() {
    if (installed) return;
    installed = true;

    // 1. Most of this codebase already calls console.error(...) inside
    // catch blocks with a descriptive message — piggyback on that
    // existing pattern for broad coverage without touching every call site.
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError(...args);
      try {
        const message = args
          .map((a) =>
            typeof a === "string" ? a : a?.message || JSON.stringify(a),
          )
          .join(" ");
        crashLogService.logError(message, { context: "console.error" });
      } catch (e) {
        // ignore
      }
    };

    // 2. Truly uncaught exceptions and unhandled promise rejections that
    // slip past every try/catch — the last line of defense. This matters
    // more here than it might elsewhere: this whole app is built on
    // async/await, and a rejected promise nobody awaited fails silently
    // by default with no error shown anywhere.
    window.addEventListener("error", (event) => {
      crashLogService.logError(event.message || "Unknown error", {
        stack: event.error?.stack,
        context: "uncaught-error",
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      crashLogService.logError(reason?.message || String(reason), {
        stack: reason?.stack,
        context: "unhandled-promise-rejection",
      });
    });
  },
};


