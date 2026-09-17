// STUBBED — no real backend exists yet. This file defines the shape sync
// will eventually take, so wiring in the real Railway/Postgres backend
// later is a swap of implementation, not a rewrite of everything that
// calls into it. Nothing here pretends to succeed; status is always
// reported honestly as 'offline' until a real backend is connected.

let listeners = [];

const state = {
  status: "offline", // 'offline' | 'syncing' | 'synced' | 'error' — never faked
  lastSyncedAt: null,
};

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...state }));
}

export const syncService = {
  getStatus: () => ({ ...state }),

  onStatusChange: (callback) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((fn) => fn !== callback);
    };
  },

  // Intentionally does nothing yet — real sync (pushing/pulling against
  // the backend, resolving conflicts between devices) is Phase 2/3 work,
  // not something to fake here just to look finished.
  async triggerSync() {
    console.log(
      "[syncService] triggerSync called — no backend connected yet, this is a stub.",
    );
    return { success: false, reason: "not_configured" };
  },
};


