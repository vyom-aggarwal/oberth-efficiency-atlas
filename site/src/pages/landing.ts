// The landing page (/; Phase 9 pass 3, docs/revamp_plan.md §2.5–2.6): the flyby preloader, the hero band with the live
// dive, the title moved by the dive's clock, the findings rows beside the docked dive (they steer it and open in place),
// the intro with the scope facts from methods.json, and the key results from the site data. The author's prose slots
// and the findings' links are built into the HTML by the content plugin. Every interaction here is this project's own
// (§1.3); the preloader's once-a-session gate is the inline script in index.html.
import "../styles/landing.css";
import type { HeroControl, Steer } from "../charts/landing-hero";
import { DASH, dashGlyph, dive } from "../charts/dive-view";
import { sourceLink } from "../lib/cite";
import { loadBinary, loadData, type SiteData } from "../lib/data";
import { h, s } from "../lib/dom";
import { flybyPoint, NU_BURN, nuAt, pathAnomalies, STAGES, stageMark, SUN_R } from "../lib/flyby";
import { sig } from "../lib/format";
import { initShell } from "./shell";

initShell("landing");

const $ = (id: string) => document.getElementById(id)!;
const root = document.documentElement;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EXPO_OUT = "cubic-bezier(.16,1,.3,1)";
const BODY_NAMES: Record<string, string> = { sun: "Sun", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" };

// ---------------------------------------------------------------- the preloader: a flyby, drawn (§2.6)
// The flyby of lib/flyby.ts, the Sun on the left as in the hero. A dot flies it from the upper right, quickest through
// perihelion, the burn arc is drawn heavier, and the stages appear at their points in physical order. They stay up, so
// none has to be read in passing. Then the screen fades. From the page's start: the flight 120–1120 ms, a 150 ms hold,
// a 350 ms fade, gone at 1.62 s on time. A late script shortens the flight so the fade ends by 1.8 s; the screen is
// removed when the main thread next runs (the fade itself runs on the compositor), and the inline gate's failsafe
// removes it at 2 s regardless (e2e/preloader.spec.ts checks 2.0 s on the production build). Any key, click, tap or
// wheel ends it at once.
const FLY_AT = 120, FLY_MS = 1000, HOLD_MS = 150, FADE_MS = 350, CAP_MS = 2000;
function preloader(): Promise<void> {
  const el = $("preloader"), svg = el.querySelector<SVGSVGElement>("svg")!;
  const now = performance.now();                                  // ms since the page's time origin
  const start = Math.max(now, FLY_AT), fly = Math.min(FLY_MS, CAP_MS - 200 - start - HOLD_MS - FADE_MS);   // 200 ms in hand
  if (!root.classList.contains("preloading") || reduced || fly < 300) { root.classList.remove("preloading"); return Promise.resolve(); }
  // Geometry, fitted to the screen (stage names need room on both sides).
  const W = innerWidth, H = innerHeight, narrow = W < 600;
  const nus = pathAnomalies(), pts = nus.map(flybyPoint);
  let x0 = -SUN_R, x1 = SUN_R, y0 = -SUN_R, y1 = SUN_R;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const mx = narrow ? 92 : 140, my = 56;
  const sc = Math.min((W - 2 * mx) / (x1 - x0), (H - 2 * my) / (y1 - y0), (0.62 * H) / (y1 - y0));
  const ox = W / 2 - ((x0 + x1) / 2) * sc, oy = H / 2 - ((y0 + y1) / 2) * sc;
  const P = ([x, y]: [number, number]) => [ox + x * sc, oy + y * sc];
  const d = (list: [number, number][]) => list.map((p, i) => `${i ? "L" : "M"}${P(p).map((v) => v.toFixed(1)).join(",")}`).join("");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const [sx, sy] = P([0, 0]);
  const flown = s("path", { class: "flown" }), burn = s("path", { class: "burn" }), dot = s("circle", { class: "dot", r: narrow ? 4 : 5 });
  const gap = narrow ? 12 : 16;
  // Each name sits off the path on its convex side, along the normal.
  const marks = STAGES.map(({ name, nu }) => {
    const { p, n: [nx, ny] } = stageMark(nu), [px, py] = P(p);
    const g = s("g", { class: "stage", "data-stage": name }, s("circle", { cx: px, cy: py, r: 2.5 }),
      s("text", { x: px + nx * gap, y: py + ny * gap, "text-anchor": nx < -0.3 ? "end" : nx > 0.3 ? "start" : "middle",
                  "dominant-baseline": ny < -0.3 ? "auto" : ny > 0.3 ? "hanging" : "middle" }, name));
    return { nu, g };
  });
  svg.replaceChildren(s("path", { class: "full", d: d(pts) }), s("circle", { class: "sun", cx: sx, cy: sy, r: SUN_R * sc }),
    burn, flown, ...marks.map((m) => m.g), dot);
  let raf = 0;
  const frame = (t: number) => {
    const nu = nuAt(clamp((t - start) / fly, 0, 1)), here = flybyPoint(nu), upto = nus.filter((v) => v < nu).map(flybyPoint);
    flown.setAttribute("d", d([...upto, here]));
    if (nu > -NU_BURN) burn.setAttribute("d", d([...nus.filter((v) => v > -NU_BURN && v < Math.min(nu, NU_BURN)).map(flybyPoint), flybyPoint(Math.min(nu, NU_BURN))]));
    const [dx, dy] = P(here); dot.setAttribute("cx", dx.toFixed(1)); dot.setAttribute("cy", dy.toFixed(1));
    marks.forEach((m) => m.g.classList.toggle("on", nu >= m.nu - 1e-9));
    if (t < start + fly) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // The fade, and the hero settling as it clears (content is in place beneath throughout; it only moves 24 px). Their
  // start times are set in page time, not as delays: a delay counts from an animation's first frame, which the rest of
  // this module's set-up holds back.
  const fadeAt = start + fly + HOLD_MS;
  const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease", fill: "forwards" });
  fade.startTime = fadeAt;
  const settle = [$("band-role"), $("band-pill"), $("band-title"), document.querySelector<HTMLElement>(".site-header")!].map((e, i) => {
    const a = e.animate([{ transform: "translateY(24px)" }, { transform: "none" }], { duration: 700, delay: i * 40, easing: EXPO_OUT, fill: "backwards" });
    a.startTime = fadeAt;
    return a;
  });
  const EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"];
  const skip = () => { cancelAnimationFrame(raf); frame(start + fly); [fade, ...settle].forEach((a) => a.finish()); root.dataset.preloader = "skipped"; };
  EVENTS.forEach((ev) => window.addEventListener(ev, skip, { passive: true, capture: true }));
  root.dataset.preloader = "running";
  root.dataset.preloaderStart = String(Math.round(now));                 // when this script took over (diagnostics)
  root.dataset.preloaderFaded = String(Math.round(fadeAt + FADE_MS));    // when the fade is scheduled to end
  return fade.finished.then(() => {
    EVENTS.forEach((ev) => window.removeEventListener(ev, skip, { capture: true }));
    cancelAnimationFrame(raf);
    root.classList.remove("preloading");
    root.dataset.preloaderMs = String(Math.round(performance.now()));    // when it was removed, from the page's start
    if (root.dataset.preloader === "running") root.dataset.preloader = "done";
    fade.cancel();
  });
}
const preloaded = preloader();

// ---------------------------------------------------------------- the title, moving with the dive's clock (§2.6)
// No ticker: the title's offset is the angle the solid stack has swept around the Sun by the dive's clock, as a fraction
// of the whole sweep, times one line's width. It creeps in on approach, rushes through perihelion and slows on escape,
// and it moves only while the clock does: during the dive's intro (under 3 s, once a session) and while the reader
// scrubs or the rows steer. Nothing moves on its own for more than 5 s, so it needs no pause control (WCAG 2.2.2).
// Still under reduced motion, wrapped at display size.
const track = $("title-track");
const line = () => h("span", { class: "line" }, "Oberth Efficiency Atlas —");
track.append(line(), line(), line());
let lineW = 1, sweep: Float64Array | null = null;
new ResizeObserver(() => { lineW = (track.firstElementChild as HTMLElement).getBoundingClientRect().width || 1; }).observe(track.firstElementChild!);
function onFrame(k: number): void {
  if (reduced || !sweep) return;
  const i = clamp(k - 1, 0, sweep.length - 1), f = sweep[i] / sweep[sweep.length - 1];
  track.style.transform = `translate3d(${(-f * lineW).toFixed(1)}px, 0, 0)`;
}

// ---------------------------------------------------------------- the findings rows and the docked dive (§2.5)
// From 1100 px wide and 700 px tall the band's dive is sticky, and as the headline scrolls away it slides from the
// centre into the right-hand column beside the rows (its offset follows the scroll; in one step under reduced motion).
// Pointing at row 01 or 03 or focusing it steers the dive to that finding's state; leaving restores the reader's own
// clock. Row 02 has no state (author, 2026-11-02): pointing at it counts as pointing at nothing. Each row also opens in
// place, at every width, to its live figure, the author's caption and its link.
const dockMq = window.matchMedia("(min-width: 1100px) and (min-height: 700px)");
const DOCK_TOP = 96;                                              // the dive's top edge, in the band and docked
const fig = $("landing-hero"), home = $("dive-home"), dock = $("dive-dock"), stage = $("landing-stage"), rowsEl = $("rows");
let control: HeroControl | null = null, docked = false, dockFrom = 0, dockSpan = 1;
type RowId = "loss" | "missions" | "hibberd";
/** Each finding's state on the dive (the engines lit by index: 0 solid stack, 1 nuclear thermal, 2 SEP-class). Row 02,
 *  the missions on the atlas, has none: the atlas covers six bodies and the dive one. */
const STATES: Partial<Record<RowId, (c: HeroControl) => Steer>> = {
  // The loss finding marks these three engines by Π and loss: every burn, the paths quiet, the clock at the end.
  loss: (c) => ({ s: c.sMax, lit: [0, 1, 2], burns: true }),
  // The case study is Hibberd et al.'s reference stack, the dive's solid stack: just after its burn.
  hibberd: (c) => ({ s: c.afterBurn(0), lit: [0] }),
};
/** The line styles of the engines a row lights, in its category column. */
const GLYPHS: Record<RowId, () => Node[]> = {
  loss: () => DASH.map((dash) => dashGlyph(dash)),
  missions: () => [],
  hibberd: () => [dashGlyph(DASH[0])],
};
const heads = [...rowsEl.querySelectorAll<HTMLButtonElement>(".row-head")];
const rowOf = (b: HTMLElement) => b.closest("li")!.dataset.row as RowId;
/** The row's button if the row steers the dive, else null. */
const steerable = (el: Element | null) => {
  const b = el?.closest("li")?.querySelector<HTMLButtonElement>(".row-head") ?? null;
  return b && STATES[rowOf(b)] ? b : null;
};
heads.forEach((b) => b.querySelector(".g")!.append(...GLYPHS[rowOf(b)]()));
function measureDock(): void {
  if (!docked) return;
  const sr = stage.getBoundingClientRect(), dr = dock.getBoundingClientRect(), role = $("band-role");
  fig.style.setProperty("--dock-dx", `${(sr.left + sr.width / 2 - (dr.left + dr.width / 2)).toFixed(1)}px`);
  // The slide starts once the headline has cleared the dive's top edge, and takes 30 % of the screen's height.
  dockFrom = role.offsetTop + role.offsetHeight - DOCK_TOP + 16; dockSpan = 0.3 * innerHeight;
  dockProgress();
}
function dockProgress(): void {
  if (!docked) return;
  const p = clamp((window.scrollY - dockFrom) / dockSpan, 0, 1);
  const e = reduced ? (p >= 0.5 ? 1 : 0) : p * p * (3 - 2 * p);
  fig.style.setProperty("--dock", e.toFixed(4));
  root.classList.toggle("dive-docked", e === 1);
}
function placeDive(): void {
  docked = dockMq.matches;
  (docked ? dock : home).append(fig);
  root.classList.toggle("is-docked", docked);
  heads.forEach((b) => { if (docked && steerable(b)) b.setAttribute("aria-describedby", `row-${rowOf(b)}-steer`); else b.removeAttribute("aria-describedby"); });
  if (docked) measureDock(); else { fig.style.removeProperty("--dock"); root.classList.remove("dive-docked"); steerTo(null); }
}
window.addEventListener("scroll", dockProgress, { passive: true });
new ResizeObserver(measureDock).observe(stage);
dockMq.addEventListener("change", placeDive);
preloaded.then(measureDock);
// Steering: the row pointed at, else the focused row, else the open one, else none.
let hovered: HTMLButtonElement | null = null, focused: HTMLButtonElement | null = null, opened: HTMLButtonElement | null = null;
let steered: HTMLButtonElement | null = null;
function steerTo(b: HTMLButtonElement | null): void {
  if (b === steered) return;
  steered = b;
  rowsEl.classList.toggle("has-active", Boolean(b));
  heads.forEach((x) => x.closest("li")!.classList.toggle("is-active", x === b));
  if (control) control.steer(b ? STATES[rowOf(b)]!(control) : null);
}
const update = () => steerTo(docked ? (hovered ?? focused ?? opened) : null);
rowsEl.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  hovered = steerable(e.target as Element); update();
});
rowsEl.addEventListener("pointerleave", () => { hovered = null; update(); });
rowsEl.addEventListener("focusin", (e) => { focused = steerable(e.target as Element); update(); });
rowsEl.addEventListener("focusout", (e) => { if (!rowsEl.contains(e.relatedTarget as Node | null)) { focused = null; update(); } });
// Opening in place: one row at a time; each figure is drawn the first time its row opens.
const mounted = new Set<RowId>();
let mountFigure: (id: RowId, body: HTMLElement) => void = () => {};
const bodyOf = (b: HTMLElement) => $(b.getAttribute("aria-controls")!).querySelector<HTMLElement>(".finding-body")!;
heads.forEach((b) => b.addEventListener("click", () => {
  const open = b.getAttribute("aria-expanded") !== "true";
  for (const x of heads) {
    const on = open && x === b;
    x.setAttribute("aria-expanded", String(on));
    $(x.getAttribute("aria-controls")!).hidden = !on;
    x.closest("li")!.classList.toggle("is-open", on);
  }
  opened = open ? steerable(b) : null;
  if (open && !mounted.has(rowOf(b))) { mounted.add(rowOf(b)); mountFigure(rowOf(b), bodyOf(b)); }
  update();
  requestAnimationFrame(measureDock);
}));
placeDive();

// ---------------------------------------------------------------- the intro's scope facts and the key results
async function facts(site: SiteData): Promise<void> {
  const [m, kase] = await Promise.all([loadData<any>("methods.json"), loadData<any>("case.json")]);
  const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
  const a = m.audit;
  $("scope-facts").append(
    row("Fresh-clone audit", `${a.identical.value} of ${a.outputs.value} outputs reproduced identically (commit ${a.audited_commit.value}, ${a.date.value})`),
    row("Tests", `${m.tests_collected} in the suite; ${a.tests_passed.value} passed in the audited clone`),
    row("Analysis tag", h("a", { href: `${site.repo.url}/tree/${m.tag}`, rel: "noopener" }, `${m.tag} (commit ${m.tag_commit})`)),
    row("Sweep", `${Number(m.scope.sweep_rows.value).toLocaleString("en-GB")} simulated flybys`),
    row("Engines", m.scope.engines.map((e: { value: string }) => e.value).join(", ")),
    row("Bodies", Object.keys(m.scope.bodies.value).map((b) => BODY_NAMES[b] ?? b).join(", ")),
    row("Rebuild and audit", h("a", { href: `${site.repo.url}/blob/main/${m.repro_doc}`, rel: "noopener" }, m.repro_doc)));
  // Each key result: a number from the site data, a plain-language label for a reader who has not met Π yet (author,
  // 2026-11-04; every number in a label comes from the data too), and its source file. The 1 % threshold is the case
  // study's (Hibberd et al.'s dive, a burn centred on perihelion): its Π and how far the stack's thrust could fall.
  const one = kase.thresholds.find((t: { level: string }) => t.level === "1%"), pct = one.level.replace("%", " %");
  const result = (num: string, what: string, src: string) =>
    h("li", {}, h("span", { class: "num" }, num), h("span", { class: "what" }, what), h("span", { class: "src" }, "Source: ", sourceLink(site, src.split("#")[0])));
  $("key-results").append(
    result(Number(m.scope.sweep_rows.value).toLocaleString("en-GB"),
      `flybys simulated, with ${m.scope.engines.length} engine types at ${Object.keys(m.scope.bodies.value).length} bodies`, m.scope.sweep_rows.src),
    result(`${a.identical.value} / ${a.outputs.value}`,
      "outputs rebuilt from scratch in a fresh copy of the repository match the committed ones", a.identical.src),
    result(sig(one.Pi.value, 3),
      `periapsis timescales: a burn centred on periapsis and shorter than this loses under ${pct} of its Δv. One timescale is ` +
      "the periapsis distance divided by the speed there.", one.Pi.src),
    result(`${sig(one.thrust_scale_divisor.value, 3)}×`,
      `less thrust, and Hibberd et al.'s solid stack would still lose no more than ${pct} of its Δv on its dive past the Sun`,
      one.thrust_scale_divisor.src));
}

// ---------------------------------------------------------------- data: the dive (drawn beneath the preloader; its intro
// starts as it clears), the case pill, the findings' figures, the facts
(async () => {
  const [{ landingHero }, site, engines] = await Promise.all([
    import("../charts/landing-hero"), loadData<SiteData>("site.json"), loadData<any>("engines.json")]);
  $("band-pill").append(h("span", {}, "Hibberd et al.'s dive,", h("br"), `perihelion ${engines.units.r_p_over_R_sun.value} R☉`),
    h("span", { class: "sun-mark", "aria-hidden": "true" }));
  const buf = await loadBinary(engines.binary);
  // The angle the solid stack has swept around the Sun, sample by sample (the radial mapping keeps angles).
  const solid = dive(engines, buf).cases[0];
  sweep = new Float64Array(solid.X.length);
  for (let i = 1; i < solid.X.length; i++) {
    let da = Math.atan2(solid.Y[i], solid.X[i]) - Math.atan2(solid.Y[i - 1], solid.X[i - 1]);
    da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
    sweep[i] = sweep[i - 1] + Math.abs(da);
  }
  control = landingHero(fig, fig.querySelector<HTMLElement>(".landing-hero-body")!, engines, buf, site,
    { reducedMotion: reduced, start: preloaded, onFrame });
  steered = null; update();
  mountFigure = (id, body) => {
    const load = async () => {
      const f = await import("../charts/findings");
      if (id === "loss") f.lossFinding(body, await loadData<any>("curve.json"), engines, site);
      else if (id === "missions") { const [atlas, missions] = await Promise.all([loadData<any>("atlas.json"), loadData<any>("missions.json")]); f.missionsFinding(body, atlas, missions, site); }
      else f.hibberdFinding(body, await loadData<any>("case.json"), site);
    };
    load().catch((err) => {
      console.error(err);
      body.append(h("p", { class: "figure-error", role: "alert" }, "This figure could not load its data. Reload the page to try again."));
    });
  };
  for (const b of heads) if (b.getAttribute("aria-expanded") === "true" && !mounted.has(rowOf(b))) { mounted.add(rowOf(b)); mountFigure(rowOf(b), bodyOf(b)); }
  // The facts below the findings, once the preloader has gone (their set-up would hold up its frames).
  await preloaded;
  await facts(site);
})().catch((err) => {
  console.error(err);
  document.querySelector(".landing-hero-body")?.append(h("p", { class: "figure-error", role: "alert" }, "This figure could not load its data. Reload the page to try again."));
});
