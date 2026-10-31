export function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The Home screen's duty-time clock: "00:42", "59:59", then hours — "1:00:00", "35:46:09".
// Minutes alone grew to "2146:09" on a long shift, which reads as nothing at all.
export function formatClock(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

// ₹ with Indian comma grouping (₹2,140.00, ₹8,760.00) — the Earnings
// screens' weekly/monthly totals are large enough that plain toFixed(2)
// reads wrong.
export function formatCurrency(amount) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "Today, 6:42 PM" for a deposit made earlier today (matches the Figma copy exactly), a dated
// "26 Jul, 6:42 PM" otherwise — used by DepositConfirmed.jsx for a real deposit's createdAt.
export function formatDateTime(dateInput) {
  const date = new Date(dateInput);
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (date.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  const day = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${day}, ${time}`;
}

// "15 Oct 2001" — a calendar date (date of birth, insurance validity), same form as the date picker.
export function formatDate(dateInput) {
  if (!dateInput) return null;
  return new Date(dateInput).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// "XXXX XXXX 1234" — Aadhaar is shown masked to the last four digits (UIDAI's guidance for
// displaying it); the full number stays editable only on the form itself.
export function maskAadhaar(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (digits.length < 4) return number || null;
  return `XXXX XXXX ${digits.slice(-4)}`;
}
