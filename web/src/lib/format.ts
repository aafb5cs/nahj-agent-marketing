const idr = new Intl.NumberFormat("id-ID");

/** Whole rupiah, written the Indonesian way: Rp 49.000 */
export function rupiah(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}Rp ${idr.format(Math.abs(n))}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Dates are shown in Jakarta time (WIB). */
export function date(iso: string): string {
  return dateFmt.format(new Date(iso));
}
export function dateTime(iso: string): string {
  return `${dateTimeFmt.format(new Date(iso))} WIB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const palette = ["#4b32e6", "#1f8f6a", "#d0772a", "#c2417a", "#2f6fd1", "#7a4fa6", "#b8512f", "#2a8a9a"];
/** Stable colour for a name, used for avatars and seller tiles. */
export function colorFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length]!;
}
