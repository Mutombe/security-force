// Small, dependency-free helpers shared by every screen.

export const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

export const nowISO = () => new Date().toISOString();
export const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * 86400000).toISOString();
export const addHours = (iso, n) => new Date(new Date(iso).getTime() + n * 3600000).toISOString();
export const daysUntil = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
export const hoursUntil = (iso) => (new Date(iso).getTime() - Date.now()) / 3600000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Present';
export const fmtMonth = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Present');
export const fmtTime = (d) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtClock = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "3h ago", "in 2d", "just now" */
export function fromNow(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  const s = m < 1 ? 'just now' : m < 60 ? `${m}m` : h < 24 ? `${h}h` : d < 45 ? `${d}d` : `${Math.round(d / 30)}mo`;
  if (s === 'just now') return s;
  return diff < 0 ? `${s} ago` : `in ${s}`;
}

export const initials = (n = '') =>
  n
    .split(' ')
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;

// ---- Live badge: a 6-digit code that rotates every 30 seconds (TOTP-style) ----
// Deterministic from Workforce ID + time window, so any tab can compute it.
export function badgeCode(guardId, t = Date.now()) {
  const w = Math.floor(t / 30000);
  let h = 2166136261;
  for (const ch of `${guardId}:${w}:security-force`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 1000000).padStart(6, '0');
}
export const badgeSecondsLeft = (t = Date.now()) => 30 - Math.floor((t / 1000) % 30);
export const checkBadgeCode = (guardId, code) =>
  [0, -30000].some((off) => badgeCode(guardId, Date.now() + off) === String(code).trim());

// ---- CSV export ----
export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, -1).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  const head = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

// Resize an uploaded image to a small square JPEG data URL (keeps sessionStorage small).
export function fileToAvatar(file, size = 160) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export const randomSecret = (len = 32) =>
  Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

// Scale an uploaded logo to fit within `max`px, keeping its shape and transparency.
export function fileToLogo(file, max = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}
