// Tanzanian numbers are usually entered locally as 07XXXXXXXX — WhatsApp's
// deep link needs full international format with no leading zero. Same
// normalization logic already proven on the phone app.
const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return "255" + digits.slice(1);
  if (digits.length === 9) return "255" + digits;
  return digits;
};

export const whatsappService = {
  normalizePhone,

  // Opens via Electron's shell.openExternal (bridged through preload) —
  // hands off to the OS's real browser or WhatsApp Desktop, not something
  // the sandboxed renderer window should try to navigate itself to.
  async sendMessage(phone, message) {
    const normalized = normalizePhone(phone);
    if (!normalized)
      return { success: false, error: "Namba ya simu si sahihi" };
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    await window.hisaflow.openExternal(url);
    return { success: true };
  },
};


