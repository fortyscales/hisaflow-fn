// Genuine Electron/Chromium capability — the standard Web Notification
// API works directly in the renderer, no IPC needed, no native share
// sheet limitation like we hit with social posting. Wrapped in a
// try/catch regardless: a user could have OS notifications disabled
// entirely, and a failed notification should never be the thing that
// breaks the app.
const SESSION_KEY = "hisaflow_notified_this_session";

export const notificationService = {
  // Shows at most once per app session (not once per render, not every
  // time the dashboard mounts) — a shop with 5 low-stock items every
  // single day would make this pure noise otherwise.
  showOnceThisSession(title, body) {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") new Notification(title, { body });
        });
      }
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch (err) {
      // Notifications are a nice-to-have, never worth crashing over.
    }
  },
};


