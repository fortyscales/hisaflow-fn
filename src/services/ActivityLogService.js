import { dataService } from "./DataService";

// Services are plain functions, not React components — they can't reach
// into App.jsx's currentUser state directly, and prop-drilling it through
// every screen down into every service call site would be a much bigger
// change than this feature warrants. Instead, App.jsx calls setCurrentActor
// once at login/logout; every other service just calls logActivity and
// this module remembers who's actually doing it.
let currentActorName = null;

export const setCurrentActor = (name) => {
  currentActorName = name;
};

// Same reasoning as setCurrentActor — receipts need to show who served
// the customer, but ReceiptModal/PaymentReceiptModal are rendered from
// screens that don't have currentUser passed down. Reusing this same
// module-level value avoids prop-drilling it everywhere just for a
// receipt line.
export const getCurrentActor = () => currentActorName;

export const activityLogService = {
  async logActivity(action, details) {
    const entry = {
      id: `log_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`,
      action,
      details: details || "",
      actorName: currentActorName || "Unknown",
      date: new Date().toISOString(),
    };
    await dataService.appendActivityLog(entry);
  },
};
