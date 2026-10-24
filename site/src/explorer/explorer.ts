// The explorer: one flyby, simulated live from four nondimensional inputs (Π, v∞/v_esc, Δv/v_p, Δv/c) and a
// steering law; presets fill the inputs and keep their body's scales for SI readouts and the SOI check. The URL
// holds the case. Design: RESEARCH_LOG 2026-10-18 (checkpoint 5). Every number comes from the simulator or from
// the exported data (presets.json, hero.json, curve.json).
import tex from "virtual:tex";
import { axisSlider, type Mark } from "../controls/axis-slider";
import { segmented } from "../charts/common";
import { frag, h, s, setText } from "../lib/dom";
import { duration, lossRel, sig, speed } from "../lib/format";
import { fromTargets, R_FLOOR, simulate, type SimResult } from "../sim/oberth-sim.js";
import { flybyPath, impulsivePath } from "../sim/paths";
import { atlasPlacement, curvePlacement, type CurveLite, type TheoryAtlas } from "./placement";
import { buildPresets, type HeroCase, type Preset, type PresetsData } from "./presets";
import { parseState, RANGES, serializeState, type ExplorerState, type Steering } from "./state";
import { trajectoryView } from "./view";

export interface ExplorerData {
  presets: PresetsData & { theory_atlas: TheoryAtlas };
  hero: HeroCase;
  curve: Omit<CurveLite, "thresholds"> & { thresholds: { level: string; loss_rel: number; Pi: { value: number } }[] };
}

const EXTEND = 16;                                         // coast drawn beyond the simulated window, time units

export function explorer(root: HTMLElement, d: ExplorerData): void {
  const presets = buildPresets(d.presets, d.hero);
  const byId = new Map(presets.map((p) => [p.id, p]));
  const hib = byId.get("hibberd")!;
  // Default: the Hibberd preset as it is (an interface choice), or the case in the URL.
  const fallback: ExplorerState = { ...hib.inputs, steering: "prograde", preset: "hibberd" };
  const state = parseState(location.search, fallback);
  if (!byId.has(state.preset)) state.preset = "none";
  // A URL naming a preset but no inputs (e.g. ?preset=earth.hall) means the preset's own inputs.
  const query = new URLSearchParams(location.search);
  if (state.preset !== "none" && !["Pi", "v", "dv", "c"].some((k) => query.has(k))) Object.assign(state, byId.get(state.preset)!.inputs);

  const controls = root.querySelector<HTMLElement>(".explorer-controls")!;
  const viewBox = root.querySelector<HTMLElement>(".explorer-view")!;
  const readBox = root.querySelector<HTMLElement>(".explorer-readouts")!;
  const placeBox = root.querySelector<HTMLElement>(".explorer-placement")!;

  // ---------------------------------------------------------------- controls
  const select = h("select", { class: "select", id: "ex-preset" }, h("option", { value: "none" }, "None: nondimensional inputs only"));
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const p of presets) {
    if (!groups.has(p.group)) { const g = h("optgroup", { label: p.group }); groups.set(p.group, g); select.append(g); }
    groups.get(p.group)!.append(h("option", { value: p.id }, p.label));
  }
  const presetNote = h("p", { class: "explorer-note", id: "ex-preset-note" });
  const lab = (t: string) => { const e = h("span", {}); e.append(frag(t)); return e; };
  const marks: Mark[] = d.curve.thresholds.map((t) => ({ value: t.Pi.value, label: t.level.replace("%", " %"), kind: "threshold",
    detail: `The near-parabolic band reaches ${t.level.replace("%", " %")} loss at Π = ${sig(t.Pi.value)}` }));
  const sl = {
    Pi: axisSlider({ id: "ex-pi", label: lab(tex.Pi), min: RANGES.Pi[0], max: RANGES.Pi[1], value: state.Pi, marks }),
    v: axisSlider({ id: "ex-v", label: lab(tex.vRatio), min: 0.01, max: RANGES.v[1], value: Math.max(0.01, state.v) }),
    dv: axisSlider({ id: "ex-dv", label: lab(tex.dvOverVp), min: RANGES.dv[0], max: RANGES.dv[1], value: state.dv }),
    c: axisSlider({ id: "ex-c", label: lab(tex.dvOverC), min: RANGES.c[0], max: RANGES.c[1], value: state.c }),
  };
  const steer = segmented<Steering>("ex-steer", "Steering", [["prograde", "prograde"], ["inertial", "inertial"]], state.steering, (v) => {
    state.steering = v; request();
  });
  const copy = h("button", { class: "button", type: "button" }, "Copy link");
  const copied = h("span", { class: "explorer-note", role: "status" });
  copy.addEventListener("click", () => {
    const done = (t: string) => { copied.textContent = t; setTimeout(() => (copied.textContent = ""), 2500); };
    navigator.clipboard?.writeText(location.href).then(() => done("Link copied."), () => done("Copy the address bar to share this case."));
  });
  controls.append(
    h("h2", { class: "region-title" }, "Case"),
    h("label", { class: "field", for: "ex-preset" }, h("span", { class: "control-label" }, "Preset (fills the inputs; its body sets the SI readouts)"), select),
    presetNote,
    sl.Pi.el, sl.v.el, sl.dv.el, sl.c.el,
    h("div", { class: "field" }, h("span", { class: "control-label" }, "Steering"), steer),
    h("div", { class: "explorer-actions" }, copy, copied));

  let syncing = false;                                     // set while the code (not the reader) moves a slider
  const setSlider = (k: "Pi" | "v" | "dv" | "c", v: number) => {
    syncing = true;
    sl[k].value.set(k === "v" ? Math.max(0.01, v) : v);
    syncing = false;
    if (k === "v" && v === 0) sl.v.el.querySelector<HTMLInputElement>("input.number")!.value = "0";   // parabolic
  };
  // Subscribing calls back at once with the slider's own value, which for v∞/v_esc = 0 is the slider's minimum:
  // guarded, so the state keeps the exact value (and nothing runs before it is set up).
  syncing = true;
  for (const k of ["Pi", "v", "dv", "c"] as const) sl[k].value.subscribe((v) => {
    if (syncing) return;
    state[k] = v;
    request();
  });
  syncing = false;
  select.value = state.preset;
  if (state.preset !== "none") setSlider("v", state.v);
  select.addEventListener("change", () => {
    state.preset = select.value;
    const p = byId.get(state.preset);
    if (p) {
      Object.assign(state, p.inputs);
      for (const k of ["Pi", "v", "dv", "c"] as const) setSlider(k, p.inputs[k]);
    }
    view.reset();
    request();
  });

  // ---------------------------------------------------------------- view, readouts, placement
  const canvas = h("canvas", { class: "explorer-canvas" });
  const reset = h("button", { class: "button", type: "button" }, "Reset view");
  viewBox.append(h("h2", { class: "region-title" }, "Trajectory"), h("div", { class: "explorer-stage" }, canvas),
    h("div", { class: "explorer-toolbar" }, reset,
      h("span", { class: "explorer-note" }, "Wheel or pinch to zoom, drag to pan; on the view, + − arrows and 0 (reset).")));
  const view = trajectoryView(canvas);
  reset.addEventListener("click", () => view.reset());

  const readouts = h("dl", { class: "facts explorer-readouts-list" });
  const warnings = h("ul", { class: "explorer-warnings", role: "status", "aria-live": "polite" });
  const avKey = h("p", { class: "explorer-note" });
  readBox.append(h("h2", { class: "region-title" }, "Results"), readouts, warnings, avKey);

  const curveBox = h("div", { class: "explorer-place" }), atlasBox = h("div", { class: "explorer-place" });
  const curveSummary = h("p", { class: "summary" }), atlasSummary = h("p", { class: "summary" });
  placeBox.append(h("h2", { class: "region-title" }, "Where this case sits"),
    h("div", { class: "explorer-place-grid" },
      h("figure", { class: "explorer-place-fig" }, h("figcaption", {}, "On the universal curve (simulation band; the ring is this case)"), curveBox, curveSummary),
      h("figure", { class: "explorer-place-fig" }, h("figcaption", {}, "On the Δv → 0 theory atlas (linear response, prograde)"), atlasBox, atlasSummary)));
  const onCurve = curvePlacement(curveBox, d.curve);
  const onAtlas = atlasPlacement(atlasBox, d.presets.theory_atlas);

  // ---------------------------------------------------------------- one simulation per frame
  let pending = false;
  function request(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; run(); });
  }
  function run(): void {
    const p = byId.get(state.preset);
    const sc = p?.scales;
    const nd = fromTargets(state.Pi, state.v, state.dv, state.c);
    const impact = sc ? sc.R / sc.r_p : R_FLOOR;
    let res: SimResult | null = null, err = "";
    try {
      res = simulate({ ...nd, steering: state.steering, record: true, impactRadius: impact });
    } catch (e) {
      err = String((e as Error).message ?? e);
    }
    history.replaceState(null, "", `?${serializeState(state)}`);
    edited(p);
    if (!res) { readouts.replaceChildren(h("div", {}, h("dt", {}, "Simulation"), h("dd", {}, err))); return; }
    const path = flybyPath(res, nd.a0, EXTEND);
    const vp = Math.sqrt(nd.v_inf ** 2 + 2);
    const avs = path.burn.map((q) => q.av!).filter((a) => a > 0);   // empty if an impact came before the burn
    const avLog: [number, number] = avs.length ? [Math.log10(Math.min(...avs)), Math.log10(Math.max(...avs))] : [0, 0];
    const etaWords = Number.isFinite(res.eta) ? etaText(res.eta) : res.impacted ? "undefined (impact)" : "undefined (captured)";
    view.setScene({ path, impulsive: impulsivePath(vp, nd.dv, EXTEND + 6), bodyRadius: sc ? sc.R / sc.r_p : null, sun: sc?.body === "sun", avLog,
      label: `Trajectory of the flyby: Π = ${sig(res.Pi)}, η = ${etaWords}` });
    showReadouts(res, nd, p);
    const unit = sc ? "W/kg" : "(simulator units)";
    const k = sc ? (sc.V ** 3) / sc.r_p : 1;
    avKey.replaceChildren();
    if (avs.length) {
      avKey.append(h("span", { class: "ramp-bar", "aria-hidden": "true" }), " ", frag(tex.av),
        ` along this burn: ${sig(10 ** avLog[0] * k, 2)} to ${sig(10 ** avLog[1] * k, 2)} ${unit}`);
    }
    setText(curveSummary, onCurve(res.Pi, res.captured || res.impacted ? null : res.loss_rel));
    setText(atlasSummary, onAtlas(res.Pi, state.v));
  }

  function edited(p: Preset | undefined): void {
    if (!p) { presetNote.textContent = ""; return; }
    const same = (["Pi", "v", "dv", "c"] as const).every((k) => Math.abs(state[k] - p.inputs[k]) <= 1e-6 * Math.max(1e-12, Math.abs(p.inputs[k])));
    const rp = p.scales.r_p / p.scales.R;
    presetNote.textContent = (p.id === "hibberd" ? `${byId.get("hibberd")!.note} ` : "") +
      (same ? `Periapsis at ${sig(rp, 3)} ${p.scales.name} radii.` :
        `Inputs changed from the preset; ${p.scales.name} (periapsis at ${sig(rp, 3)} radii) still sets the SI readouts and the SOI check.`);
  }

  function showReadouts(res: SimResult, nd: { v_inf: number; dv: number; c: number; a0: number }, p: Preset | undefined): void {
    const sc = p?.scales;
    const row = (k: Node | string, v: string, id: string) => h("div", {}, h("dt", {}, k), h("dd", { id }, v));
    const rows = [
      row(lab(tex.eta), Number.isFinite(res.eta) ? etaText(res.eta) : res.impacted ? "undefined (impact)" : "undefined (captured)", "ex-eta"),
      row("loss/Δv", Number.isFinite(res.loss_rel) ? lossRel(res.loss_rel) : "—", "ex-loss"),
      row(lab(tex.Pi), sig(res.Pi), "ex-pi-out"),
      row("closest approach", sc ? `${sig((res.r_min * sc.r_p) / sc.R, 4)} ${sc.name} radii` : `${sig(res.r_min, 4)} r_p`, "ex-rmin"),
      row("v∞ after (impulsive)", Number.isFinite(res.v_inf_out)
        ? (sc ? `${speed(res.v_inf_out * sc.V, 4)} (${speed(res.v_inf_imp * sc.V, 4)})` : `${sig(res.v_inf_out, 4)} (${sig(res.v_inf_imp, 4)})`)
        : res.impacted ? "—" : "bound", "ex-vout"),
    ];
    if (sc) {
      const dvSI = nd.dv * sc.V;
      rows.push(row("burn", duration((res.t_b * sc.r_p) / sc.V), "ex-burn"),
        row("Δv", speed(dvSI), "ex-dv-si"),
        row("loss", Number.isFinite(res.loss_rel) ? speed(res.loss_rel * dvSI) : "—", "ex-loss-si"));
    }
    readouts.replaceChildren(...rows);
    // Warnings: an icon and text, never colour alone.
    const w: [string, string][] = [];
    if (res.impacted) w.push(["impact", sc ? `Impact: the path passes below ${sc.name}'s surface.` : "Impact: the path reaches the centre (r < 0.001 r_p)."]);
    if (res.captured) w.push(["captured", "Captured: bound after the burn, so η is undefined; the loss is the equivalent-Δv penalty."]);
    const burn = res.segments!.find((q) => q.burn && q.t.length > 0);
    if (sc?.soi && burn) {
      const r0 = Math.hypot(burn.y[0][0], burn.y[0][1]) * sc.r_p;
      if (r0 > sc.soi) w.push(["soi", `The burn starts outside ${sc.name}'s sphere of influence (${sig(r0 / sc.soi, 3)} × its radius), where the two-body model does not hold.`]);
    }
    warnings.replaceChildren(...w.map(([kind, text]) => h("li", { class: `warning warning-${kind}` }, warnIcon(), h("span", {}, text))));
  }

  for (const k of ["Pi", "v", "dv", "c"] as const) setSlider(k, state[k]);
  request();
}

const etaText = (eta: number) => (Math.abs(1 - eta) < 1e-3 ? eta.toFixed(6) : sig(eta, 4));

function warnIcon(): SVGSVGElement {
  return s("svg", { class: "warn-icon", width: 18, height: 16, viewBox: "0 0 18 16", "aria-hidden": "true" },
    s("path", { d: "M9 1 L17 15 H1 Z", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linejoin": "round" }),
    s("path", { d: "M9 6 V10 M9 12.2 V12.4", stroke: "currentColor", "stroke-width": 1.6, "stroke-linecap": "round" }));
}
