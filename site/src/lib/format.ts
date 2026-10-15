// Number formatting for interface text. Values always come from exported data; these functions only
// choose how many figures to show.

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
export const superscript = (s: string | number) => String(s).replace(/[-0-9]/g, (c) => SUP[c]);
const MINUS = "−";

/** n significant figures, plain notation for 1e-3 <= |x| < 1e5, otherwise a × 10ⁿ. */
export function sig(x: number, n = 3): string {
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return "0";
  const ax = Math.abs(x);
  if (ax >= 1e-3 && ax < 1e5) {
    const digits = Math.max(0, n - 1 - Math.floor(Math.log10(ax)));
    return x.toFixed(Math.min(digits, 12)).replace("-", MINUS);
  }
  return sci(x, n);
}

/** a × 10ⁿ with n significant figures in a. */
export function sci(x: number, n = 3): string {
  const [m, e] = x.toExponential(n - 1).split("e");
  return `${m.replace("-", MINUS)} × 10${superscript(Number(e))}`;
}

/** 10ⁿ for an exact power of ten, else plain. */
export function pow10(x: number): string {
  const e = Math.round(Math.log10(x));
  if (Math.abs(x / 10 ** e - 1) > 1e-9) return sig(x);
  return e === 0 ? "1" : `10${superscript(e)}`;
}

/** Π tick labels: plain decimals over the shared decades (0.001 … 1000). */
export function decade(x: number): string {
  const e = Math.round(Math.log10(x));
  return e < 0 ? x.toFixed(-e) : String(Math.round(x));
}

/** A loss fraction: percent when >= 0.1 %, else a × 10ⁿ (as a fraction). */
export function lossRel(x: number, n = 3): string {
  if (!Number.isFinite(x)) return "—";
  return x >= 1e-3 ? `${sig(100 * x, n)} %` : sci(x, n);
}

/** A duration in the largest sensible unit (s, min, h, d), n significant figures. */
export function duration(seconds: number, n = 3): string {
  if (seconds < 60) return `${sig(seconds, n)} s`;
  if (seconds < 3600) return `${sig(seconds / 60, n)} min`;
  if (seconds < 48 * 3600) return `${sig(seconds / 3600, n)} h`;
  return `${sig(seconds / 86400, n)} d`;
}

export function speed(mPerS: number, n = 3): string {
  return mPerS >= 1000 ? `${sig(mPerS / 1000, n)} km/s` : `${sig(mPerS, n)} m/s`;
}
