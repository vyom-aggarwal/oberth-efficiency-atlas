// Notation (Phase 8, the author's fix 3, 2026-10-23): subscripts and superscripts written in interface and data strings
// as "v_esc", "Π_{eff}", "r^−1.5" or "r^{−κ}" are typeset, so no displayed text shows an underscore:
//   HTML  <sub>/<sup>;  SVG  a tspan shifted to the sub- or superscript baseline;  plain text (accessible names and
//   title attributes)  Unicode sub- or superscript characters where every character has one, otherwise the index after
//   a space ("v esc", read aloud as such). Canvas labels write their indices as Unicode directly (e.g. "rₚ").
// Only a lone letter takes an index, and the index must end the name: the base must not follow a letter or digit, and
// no underscore, letter or digit may follow the index, so file and code names (anim_numbers.json, r_burn_start) never
// match. The DOM helpers (dom.ts) apply this to every string they append, except inside code.
const RE = /(?<![\p{L}\p{N}])(\p{L})([_^])(\{[^}]*\}|[−-]?[0-9.]*[0-9]|\p{L}+)(?![_\p{L}\p{N}])/gu;

// File names in running text (e.g. a selection rule quoting its script) are set as code.
const FILE = /(?<![\w/.-])((?:[\w.-]+\/)*[\w-]+\.(?:py|json|parquet|md|csv|ya?ml|png|bin|ts|mjs|js|html))(?![\w/-])/g;

export interface Part { text: string; index?: "sub" | "sup"; code?: boolean }

/** The string split into plain runs, file names (code), and the sub- and superscript indices after a lone letter. */
export function parts(text: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(FILE)) {
    out.push(...indices(text.slice(last, m.index)), { text: m[1], code: true });
    last = m.index! + m[0].length;
  }
  out.push(...indices(text.slice(last)));
  return out.filter((p) => p.text !== "");
}

function indices(text: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const at = m.index!;
    out.push({ text: text.slice(last, at) + m[1] });
    out.push({ text: m[3].replace(/^\{|\}$/g, ""), index: m[2] === "_" ? "sub" : "sup" });
    last = at + m[0].length;
  }
  out.push({ text: text.slice(last) });
  return out;
}

// Not global: a global regex's lastIndex would leak into matchAll.
const TEST = new RegExp(RE.source, "u"), TEST_FILE = new RegExp(FILE.source);
export const hasNotation = (text: string): boolean => TEST.test(text) || TEST_FILE.test(text);

const SUB: Record<string, string> = Object.fromEntries([..."0123456789+−-=()aehijklmnoprstuvx"].map((c, i) =>
  [c, [..."₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ"][i]]));
const SUP: Record<string, string> = Object.fromEntries([..."0123456789+−-=()in"].map((c, i) =>
  [c, [..."⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁱⁿ"][i]]));

/** Plain text: Unicode indices where every character has one, else the index after a space (sub) or "^" (sup). */
export function plain(text: string): string {
  return parts(text).map((p) => {
    if (!p.index) return p.text;
    const map = p.index === "sub" ? SUB : SUP;
    const chars = [...p.text];
    if (chars.every((c) => c in map)) return chars.map((c) => map[c]).join("");
    return p.index === "sub" ? ` ${p.text}` : `^${p.text}`;
  }).join("");
}

/** DOM nodes for the string: text, and <sub>/<sup> (HTML) or shifted tspans (SVG, when `svg` is set). */
export function typeset(text: string, svg = false): Node[] {
  return parts(text).map((p) => {
    if (p.code && !svg) {
      const el = document.createElement("code");
      el.textContent = p.text;
      return el;
    }
    if (!p.index) return document.createTextNode(p.text);
    if (!svg) {
      const el = document.createElement(p.index);
      el.textContent = p.text;
      return el;
    }
    const t = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    // Explicit shifts (of the index's own size): Chrome's "sub" drops a 9 px index ~4 px, below a tight axis title's box.
    t.setAttribute("baseline-shift", p.index === "sub" ? "-0.25em" : "0.45em");
    t.setAttribute("font-size", "75%");
    t.textContent = p.text;
    return t;
  });
}
