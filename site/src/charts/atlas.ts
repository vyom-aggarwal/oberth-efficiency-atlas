// The atlas: η over (Π, v∞/v_esc) on the sweep's own cells (scripts/fig_atlas.py), for one steering law and one
// Δv/V slice. η in [0, 1] on the Slate ramp; η < 0, impact and cells without a reliable value as Ink textures (no
// red: plan pass 2). Impact boundaries; burn-start radius guides, or SOI washing for a chosen body; Δv → 0 theory
// contours and mission samples as layers. Every value comes from atlas.json and missions.json
// (scripts/export_site_data.py). Design: RESEARCH_LOG 2026-10-18 (checkpoint 4 design).
import { scaleLinear, scaleLog } from "d3-scale";
import tex from "virtual:tex";
import { sourceLink } from "../lib/cite";
import type { Provenance, SiteData } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { sig } from "../lib/format";
import { signal } from "../lib/signal";
import { cssVar, themeShown } from "../lib/theme";
import { chips, dataTable, labelRow, logAxes, piTick, place, segmented, svgPointer, tooltip } from "./common";

interface Slice {
  dv_over_V: number; c_over_V: number; steering: "prograde" | "inertial";
  Pi_edges: number[][]; v_over_vesc_edges: number[];
  eta: (number | null)[][]; impact: number[][]; unreliable: number[][]; r_burn_start: number[][];
  impact_contours: Record<string, number[][]>;
}
export interface AtlasData {
  provenance: Provenance; mask_r_p_over_R: number; alt_r_p_over_R: number; slices: Slice[];
  theory_contours: Record<string, Record<string, number[][]>>; bodies: { id: string; r_soi_over_R: number }[]; theory_note: string;
}
export interface MissionsData {
  bodies: string[]; engines: string[]; engine_labels: Record<string, string>;
  Pi: number[]; v_over_vesc: number[]; eta: number[]; inside_soi: number[]; body: number[]; engine: number[];
}

const PI_DOMAIN: [number, number] = [1e-3, 1e7];          // to 10⁷: atlas cells reach 1.3 × 10⁷ (RESEARCH_LOG 2026-10-18)
const PI_TICKS = Array.from({ length: 11 }, (_, i) => 10 ** (i - 3));
const V_TICKS = [0.01, 0.1, 1];
const GUIDES = [100, 1000];                                // burn-start radius guides, in r_p (as scripts/fig_atlas.py)
const BODY_NAMES: Record<string, string> = { venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", sun: "Sun" };
const cap = (id: string) => BODY_NAMES[id] ?? id;
type Status = "eta" | "negative" | "impact" | "unreliable";

export function atlas(root: HTMLElement, d: AtlasData, ms: MissionsData, site: SiteData, opt: { figN: number; title: string }): void {
  const uid = `at${opt.figN}`;
  const dvs = [...new Set(d.slices.map((x) => x.dv_over_V))].sort((a, b) => a - b);
  const steering = signal<"prograde" | "inertial">("prograde");
  const dvIndex = signal(1);                               // the middle Δv/V slice (an interface choice)
  const body = signal("none");
  const layers = signal<Set<string>>(new Set(["theory"]));
  const current = () => d.slices.find((x) => x.steering === steering.get() && x.dv_over_V === dvs[dvIndex.get()])!;

  // ---------------------------------------------------------------- frame and controls
  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title),
    h("div", { class: "prov-key", "aria-label": "Key" }, h("span", {}, "Cells: simulation"), h("span", {}, keyLine("theory-line"), "Theory, Δv → 0")));
  const select = h("select", { class: "select", id: `${uid}-body` },
    h("option", { value: "none" }, "none"), ...d.bodies.map((b) => h("option", { value: b.id }, cap(b.id))));
  select.addEventListener("change", () => body.set(select.value));
  const dvLabel = h("span", { class: "control-label" });
  dvLabel.append(frag(tex.dvOverV));
  const controls = h("div", { class: "controls" },
    h("span", {}, h("span", { class: "control-label" }, "Steering"),
      segmented(`${uid}-steer`, "Steering", [["prograde", "prograde"], ["inertial", "inertial"]], "prograde", (v) => steering.set(v))),
    h("span", {}, dvLabel,
      segmented(`${uid}-dv`, "Δv/V", dvs.map((v, i) => [String(i), sig(v, 2)] as [string, string]), "1", (v) => dvIndex.set(Number(v)))),
    h("label", { class: "inline-select" }, h("span", { class: "control-label" }, "Sphere of influence"), select),
    chips("Layers", [["theory", "Δv → 0 theory contours"], ["missions", "Mission samples"]], layers.get(), `${uid}-plot`, (on) => layers.set(on)));

  const canvas = h("canvas", { class: "atlas-canvas", "aria-hidden": "true" });
  const svg = s("svg", { role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary`, id: `${uid}-plot` });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const plot = h("div", { class: "plot atlas-plot" }, canvas, svg, overlay);
  const tip = tooltip(plot);
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  const tableBody = h("div", {});                         // filled when opened (585 rows)
  const table = h("details", { class: "data" }, h("summary", {}, "Show data: every cell of this slice"), tableBody);
  table.addEventListener("toggle", () => table.open && fillTable());
  root.append(head, controls, plot, legend(), summary, table);

  let width = 0;
  const redraw = () => tip.redraw(() => draw(width));          // an open tooltip survives (common.tooltip)
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(redraw); }
  }).observe(plot);
  // ---------------------------------------------------------------- cells
  const status = (sl: Slice, i: number, k: number): Status =>
    sl.impact[i][k] ? "impact" : sl.eta[i][k] === null ? "unreliable" : (sl.eta[i][k] as number) < 0 ? "negative" : "eta";
  const soi = () => d.bodies.find((b) => b.id === body.get());
  /** Burn starts outside the chosen body's SOI: r_burn_start (r_p) × r_p/R beyond r_SOI/R. */
  const outside = (sl: Slice, i: number, k: number) => {
    const b = soi();
    return !!b && sl.r_burn_start[i][k] * d.mask_r_p_over_R > b.r_soi_over_R;
  };

  // Subscriptions run their callback at once, so they come after everything update() and draw() use.
  const changed = () => { if (width) redraw(); update(); };
  steering.subscribe(changed);
  dvIndex.subscribe(changed);
  body.subscribe(changed);
  layers.subscribe(changed);
  themeShown.subscribe(() => width && requestAnimationFrame(redraw));
  onFontsLoaded(() => width && requestAnimationFrame(redraw));

  function update(): void {
    const sl = current();
    const counts = { eta: 0, negative: 0, impact: 0, unreliable: 0 };
    let out = 0, lo = Infinity, hi = -Infinity;
    sl.eta.forEach((row, i) => row.forEach((e, k) => {
      counts[status(sl, i, k)]++;
      if (outside(sl, i, k)) out++;
      if (e !== null) { lo = Math.min(lo, e); hi = Math.max(hi, e); }
    }));
    const n = sl.eta.length * sl.eta[0].length;
    const b = soi();
    summary.textContent = `η over Π and v∞/v_esc for ${sl.steering} steering, Δv/V = ${sig(sl.dv_over_V)} and c/V = ${sig(sl.c_over_V)}: ` +
      `${n} sweep cells, η from ${sig(lo, 3)} to ${sig(hi, 3)}. ${counts.negative} cells have η < 0, ${counts.impact} impact ` +
      `(the path dips below the surface, with periapsis at ${sig(d.mask_r_p_over_R, 2)} body radii) and ${counts.unreliable} have no reliable η.` +
      (b ? ` With ${cap(b.id)}'s sphere of influence, ${out} cells start their burn outside it.` : "");
    plot.dataset.cells = String(n);
    if (table.open) fillTable();
  }

  function fillTable(): void {
    const sl = current();
    const rows: string[][] = [];
    sl.eta.forEach((row, i) => row.forEach((e, k) => {
      const v = Math.sqrt(sl.v_over_vesc_edges[i] * sl.v_over_vesc_edges[i + 1]);
      const P = Math.sqrt(Math.sqrt(sl.Pi_edges[i][k] * sl.Pi_edges[i][k + 1] * sl.Pi_edges[i + 1][k] * sl.Pi_edges[i + 1][k + 1]));
      const st = status(sl, i, k);
      rows.push([sig(v, 3), sig(P, 3), st === "impact" ? "impact" : st === "unreliable" ? "no reliable value" : sig(e as number, 4),
        sig(sl.r_burn_start[i][k], 4)]);
    }));
    const t = dataTable(`Cells of the ${sl.steering}, Δv/V = ${sig(sl.dv_over_V)} slice (cell centres)`,
      ["v∞/v_esc", "Π", "η", "burn starts at (r_p)"], rows, [1, 2, 3], h("span", {}, "Data: ", sourceLink(site, "results/sweep_nd.parquet")));
    tableBody.replaceChildren(...[...t.children].filter((c) => c.tagName !== "SUMMARY"));
  }

  // ---------------------------------------------------------------- drawing
  function draw(W: number): void {
    if (W < 240) return;
    const narrow = W < 560;
    const sl = current();
    const on = layers.get();
    const H = Math.round(narrow ? W * 1.05 : Math.min(600, Math.max(380, W * 0.62)));
    const m = { top: 54, right: narrow ? 12 : 24, bottom: 52, left: narrow ? 48 : 60 };   // two rows above: y title, line labels
    const ve = sl.v_over_vesc_edges;
    const x = scaleLog().domain(PI_DOMAIN).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain([ve[0], ve[ve.length - 1]]).range([H - m.bottom, m.top]);
    svg.replaceChildren();
    overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));

    // Cells on the canvas.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.rect(m.left, m.top, W - m.left - m.right, H - m.top - m.bottom); ctx.clip();
    const slate = [1, 2, 3, 4, 5, 6, 7].map((k) => cssVar(`--slate-${k}`));
    const ramp = scaleLinear<string>().domain(slate.map((_, k) => k / 6)).range(slate).clamp(true);
    const ink = cssVar("--ink"), paper = cssVar("--paper");
    const pattern = textures(ctx, ink, paper);
    const X = sl.Pi_edges;
    const quad = (i: number, k: number) => {
      ctx.beginPath();
      ctx.moveTo(x(X[i][k]), y(ve[i])); ctx.lineTo(x(X[i][k + 1]), y(ve[i]));
      ctx.lineTo(x(X[i + 1][k + 1]), y(ve[i + 1])); ctx.lineTo(x(X[i + 1][k]), y(ve[i + 1])); ctx.closePath();
    };
    sl.eta.forEach((row, i) => row.forEach((e, k) => {
      const st = status(sl, i, k);
      quad(i, k);
      const fill = st === "eta" ? ramp(e as number) : pattern[st];
      ctx.fillStyle = fill; ctx.fill();
      if (st === "eta") { ctx.strokeStyle = fill as string; ctx.lineWidth = 1; ctx.stroke(); }     // no hairline seams
    }));
    // A chosen body: wash the cells whose burn starts outside its sphere of influence.
    if (soi()) {
      ctx.globalAlpha = 0.72; ctx.fillStyle = paper;
      sl.eta.forEach((row, i) => row.forEach((_, k) => { if (outside(sl, i, k)) { quad(i, k); ctx.fill(); } }));
      ctx.globalAlpha = 1;
    }
    // Mission samples (all bodies, or the chosen one): filled inside the body's SOI, a ring outside it.
    let shown = 0;
    if (on.has("missions")) {
      const bi = ms.bodies.indexOf(body.get());
      ctx.lineWidth = 1;
      for (let j = 0; j < ms.Pi.length; j++) {
        if (bi >= 0 && ms.body[j] !== bi) continue;
        const px = x(ms.Pi[j]), py = y(ms.v_over_vesc[j]);
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 2 * Math.PI);
        if (ms.inside_soi[j]) { ctx.fillStyle = ink; ctx.fill(); } else { ctx.strokeStyle = ink; ctx.stroke(); }
        shown++;
      }
    }
    plot.dataset.missionPoints = String(shown);
    ctx.restore();

    // Axes, lines and labels on the SVG.
    logAxes(svg, x, y, W, H, m, { xTicks: PI_TICKS, yTicks: V_TICKS, xFmt: piTick, yFmt: (t) => sig(t, 1), everyX: narrow ? 2 : 1, grid: false });
    svg.append(s("rect", { class: "plot-frame", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom }));
    place(overlay, tex.vRatio, 0, 4, "start");
    place(overlay, tex.PiDef, (m.left + W - m.right) / 2, H - 22, "middle");
    const poly = (flat: number[]) => flat.reduce((acc, _, j) => (j % 2 ? acc : `${acc}${j ? "L" : "M"}${x(flat[j])},${y(flat[j + 1])}`), "");
    // Every line over the cells gets a Paper halo beneath it, so it reads on light and dark cells alike.
    const stroke = (cls: string, dPath: string) => svg.append(s("path", { class: "halo", d: dPath }), s("path", { class: cls, d: dPath }));
    for (const [key, cls] of [["h=0.1R", "impact-line"], ["h=1R", "impact-line alt"]] as const)
      for (const pl of sl.impact_contours[key] ?? []) stroke(cls, poly(pl));

    // Labels for the guides and contours: one row above the frame, each over its line's top end (narrower plots: the
    // legend names them).
    const labelled = W >= 640;
    const tops: { x: number; content: Node; cls?: string; to: [number, number] }[] = [];
    // Burn-start radius guides (no body chosen): staircases along the cell edges where the burn's start crosses
    // 10² and 10³ r_p (monotone along every row of the sweep), at the data's resolution.
    if (!soi()) for (const lev of GUIDES) {
      const b = sl.r_burn_start.map((row) => row.filter((r) => r >= lev).length);   // cells from the large-Π end
      if (b.every((n) => n === 0)) continue;
      let dPath = "";
      b.forEach((n, i) => {
        const [x0, x1] = [x(X[i][n]), x(X[i + 1][n])];
        dPath += `${i ? "L" : "M"}${x0},${y(ve[i])}L${x1},${y(ve[i + 1])}`;
        if (i + 1 < b.length) dPath += `L${x(X[i + 1][b[i + 1]])},${y(ve[i + 1])}`;
      });
      stroke("guide-line", dPath);
      const top = b.length - 1;
      const gx = x(X[top + 1][b[top]]);
      tops.push({ x: gx, content: h("span", {}, `${lev} `, frag(tex.rp)), cls: "guide-label", to: [gx, m.top] });
    }
    if (on.has("theory")) for (const [lev, lines] of Object.entries(d.theory_contours[sl.steering])) {
      for (const pl of lines) {
        stroke("theory-line", poly(pl));
        let j = 0;                                                  // the contour's highest point (largest v∞/v_esc)
        for (let q = 0; q < pl.length; q += 2) if (pl[q + 1] > pl[j + 1]) j = q;
        tops.push({ x: x(pl[j]), content: document.createTextNode(lev), cls: "contour-label", to: [x(pl[j]), y(pl[j + 1])] });
      }
    }
    if (labelled) {
      // The row may shift a label sideways; a leader joins each label to its line's top end.
      tops.sort((a, b) => a.x - b.x);
      labelRow(overlay, tops, m.top - 22, W).forEach((el, i) => {
        const cx = el.offsetLeft + el.offsetWidth / 2, [tx, ty] = tops[i].to;
        if (Math.hypot(cx - tx, m.top - 3 - ty) > 3) svg.append(s("path", { class: "leader", d: `M${cx},${m.top - 3}L${tx},${ty}` }));
      });
    }

    // Readout: the cell under the pointer.
    const hit = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    svg.append(hit);
    hit.addEventListener("pointermove", (ev) => {
      const [mx, my] = svgPointer(svg, ev);
      const P = x.invert(mx), V = y.invert(my);
      const i = ve.findIndex((v, j) => j + 1 < ve.length && V >= v && V < ve[j + 1]);
      if (i < 0) { tip.hide(); return; }
      const t = Math.log(V / ve[i]) / Math.log(ve[i + 1] / ve[i]);
      const edge = (k: number) => Math.exp(Math.log(X[i][k]) + t * (Math.log(X[i + 1][k]) - Math.log(X[i][k])));
      let k = -1;
      for (let j = 0; j + 1 < X[i].length; j++) if (P <= edge(j) && P > edge(j + 1)) { k = j; break; }
      if (k < 0) { tip.hide(); return; }
      const st = status(sl, i, k);
      const e = sl.eta[i][k];
      const rows: [string, string][] = [
        ["Π", `${sig(edge(k + 1), 3)} to ${sig(edge(k), 3)}`],
        ["v∞/v_esc", `${sig(ve[i], 3)} to ${sig(ve[i + 1], 3)}`],
        ["η", st === "impact" ? "impact" : st === "unreliable" ? "no reliable value" : sig(e as number, 4)],
        ["burn starts at", `${sig(sl.r_burn_start[i][k], 3)} r_p`],
      ];
      const b = soi();
      if (b) rows.push([`${cap(b.id)}'s SOI`, outside(sl, i, k) ? "burn starts outside" : "burn starts inside"]);
      tip.show(mx + 14, my - 10, h("div", {},
        h("div", { class: "tt-title" }, "Sweep cell"),
        h("dl", {}, ...rows.flatMap(([a, v]) => [h("dt", {}, a), h("dd", {}, v)])),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "results/sweep_nd.parquet"))));
    });
    hit.addEventListener("pointerleave", () => tip.hide());
  }

  // ---------------------------------------------------------------- legend
  function legend(): HTMLElement {
    const id = (k: string) => `${uid}-${k}`;
    const defs = s("svg", { width: 0, height: 0, class: "pattern-defs", "aria-hidden": "true" }, s("defs", {},
      s("pattern", { id: id("neg"), width: 6, height: 6, patternUnits: "userSpaceOnUse" },
        s("rect", { width: 6, height: 6, class: "tex-bg" }), s("path", { d: "M0,6 L6,0 M-1,1 L1,-1 M5,7 L7,5", class: "tex-line" })),
      s("pattern", { id: id("imp"), width: 6, height: 6, patternUnits: "userSpaceOnUse" },
        s("rect", { width: 6, height: 6, class: "tex-bg" }), s("path", { d: "M0,0 L6,6 M-1,5 L1,7 M5,-1 L7,1", class: "tex-line" })),
      s("pattern", { id: id("unr"), width: 6, height: 6, patternUnits: "userSpaceOnUse" },
        s("rect", { width: 6, height: 6, class: "tex-bg" }), s("circle", { cx: 3, cy: 3, r: 0.9, class: "tex-dot" })),
      s("linearGradient", { id: id("ramp") }, ...[1, 2, 3, 4, 5, 6, 7].map((k, j) => s("stop", { offset: j / 6, style: `stop-color: var(--slate-${k})` })))));
    const sw = (fill: string) => s("svg", { width: 22, height: 14, viewBox: "0 0 22 14", "aria-hidden": "true" },
      s("rect", { x: 0.5, y: 0.5, width: 21, height: 13, fill, class: "swatch" }));
    const line = (cls: string) => s("svg", { width: 22, height: 14, viewBox: "-11 -7 22 14", "aria-hidden": "true" },
      s("line", { class: cls, x1: -10, x2: 10, y1: 0, y2: 0 }));
    const dot = (filled: boolean) => s("svg", { width: 22, height: 14, viewBox: "-11 -7 22 14", "aria-hidden": "true" },
      s("circle", { r: 2.2, class: filled ? "mission-dot" : "mission-ring" }));
    const bar = h("span", { class: "atlas-ramp" }, s("svg", { width: 96, height: 10, "aria-hidden": "true" },
      s("rect", { width: 96, height: 10, fill: `url(#${id("ramp")})` })));
    const etaLab = (t: string) => { const e = h("span", {}); e.append(frag(tex.eta), t); return e; };
    const items: [Node, Node][] = [
      [h("span", { class: "ramp-ends" }, "0 ", bar, " 1"), etaLab(" (simulation, per sweep cell)")],
      [sw(`url(#${id("neg")})`), etaLab(" < 0")],
      [sw(`url(#${id("imp")})`), document.createTextNode(`Impact: the path dips below the surface (periapsis at ${sig(d.mask_r_p_over_R, 2)} body radii)`)],
      [sw(`url(#${id("unr")})`), document.createTextNode("No reliable η (captured, or outside the sweep's reliability checks)")],
      [line("impact-line"), document.createTextNode(`Impact boundary for a periapsis altitude of ${sig(d.mask_r_p_over_R - 1, 1)} R`)],
      [line("impact-line alt"), document.createTextNode(`Impact boundary for a periapsis altitude of ${sig(d.alt_r_p_over_R - 1, 1)} R`)],
      [line("guide-line"), h("span", {}, "Burn starts 100 or 1000 ", frag(tex.rp), " out (no body chosen; labelled above the plot)")],
      [sw("var(--paper)"), document.createTextNode("Washed: burn starts outside the chosen body's sphere of influence")],
      [line("theory-line"), h("span", {}, "Contours of ", frag(tex.eta), " for Δv → 0, labelled above the plot by their level (theory, layer)")],
      [h("span", {}, dot(true), dot(false)), document.createTextNode("Mission samples, burn starting inside or outside the SOI (layer)")],
    ];
    return h("div", {}, defs, h("ul", { class: "legend", "aria-label": "Legend" }, ...items.map(([g, t]) => h("li", {}, g, t))));
  }
}

/** Ink textures on Paper (8 px tiles): 45° lines (η < 0), 135° lines (impact), dots (no reliable value). */
function textures(ctx: CanvasRenderingContext2D, ink: string, paper: string): Record<"negative" | "impact" | "unreliable", CanvasPattern> {
  const tile = (draw: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const g = c.getContext("2d")!;
    g.fillStyle = paper; g.fillRect(0, 0, 8, 8);
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1;
    draw(g);
    return ctx.createPattern(c, "repeat")!;
  };
  return {
    negative: tile((g) => { g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(7, 9); g.lineTo(9, 7); g.stroke(); }),
    impact: tile((g) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 8); g.moveTo(-1, 7); g.lineTo(1, 9); g.moveTo(7, -1); g.lineTo(9, 1); g.stroke(); }),
    unreliable: tile((g) => { g.beginPath(); g.arc(4, 4, 1, 0, 2 * Math.PI); g.fill(); }),
  };
}

function keyLine(cls: string): SVGSVGElement {
  return s("svg", { width: 22, height: 10, "aria-hidden": "true" }, s("line", { class: cls, x1: 1, x2: 21, y1: 5, y2: 5 }));
}
