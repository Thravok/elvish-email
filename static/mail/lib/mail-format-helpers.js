/** Date / size helpers for mail list and detail panes. */

export function formatDate(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const dayMs = 86400000;
  if (now - d < dayMs && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (now - d < 7 * dayMs) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatFullDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString([], { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatAttachmentSize(bytes) {
  const n = Number(bytes && bytes.length ? bytes.length : bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let cur = n;
  while (cur >= 1024 && idx < units.length - 1) {
    cur /= 1024;
    idx += 1;
  }
  return `${cur >= 10 || idx === 0 ? cur.toFixed(0) : cur.toFixed(1)} ${units[idx]}`;
}
