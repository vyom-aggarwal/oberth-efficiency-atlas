/* Oberth Flyby Explorer: controls, live simulation (OberthSim) and canvas drawing. */
(function () {
  "use strict";
  const D = window.EXPLORER_DATA;
  const S = window.OberthSim;
  const $ = (id) => document.getElementById(id);
  const G0 = D.g0;
  const BODY_ORDER = ["sun", "venus", "earth", "mars", "jupiter", "saturn"];
  const ENGINE_ORDER = ["solid", "hydrolox", "methalox_vac", "nuclear_thermal", "hall", "gridded_ion"];
  const DV_RANGE = [0.05, 12.0];                  // km/s; spans the preset 0.2–3 km/s and the 8.36 km/s solar Oberth

  // ---------- sliders: integer 0..1000 mapped to a linear or logarithmic range
  function slider(el, lo, hi, log) {
    const s = {
      lo, hi, log,
      get() { const f = el.value / 1000; return log ? lo * Math.pow(hi / lo, f) : lo + (hi - lo) * f; },
      set(v) {
        v = Math.min(Math.max(v, lo), hi);
        el.value = Math.round(1000 * (log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo)));
      },
    };
    return s;
  }
  const sl = {};

  // ---------- formatting
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const sup = (n) => String(n).split("").map((ch) => SUP[ch] || ch).join("");
  function fmt(x, sig = 3) {
    if (!Number.isFinite(x)) return "–";
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) {
      const e = Math.floor(Math.log10(a)), m = x / Math.pow(10, e);
      return `${m.toFixed(Math.max(sig - 1, 0))}×10${sup(e)}`;
    }
    return Number(x.toPrecision(sig)).toString();
  }
  function fmtDuration(s) {
    if (s < 120) return `${s.toFixed(0)} s`;
    if (s < 7200) return `${(s / 60).toFixed(1)} min`;
    if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
    return `${(s / 86400).toFixed(1)} days`;
  }

  // ---------- setup
  function option(sel, value, text) { const o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }
  BODY_ORDER.forEach((k) => option($("body"), k, D.bodies[k].name));
  ENGINE_ORDER.forEach((k) => D.engines[k] && option($("engine"), k, D.engines[k].label));

  function bodyRanges() {
    const b = D.bodies[$("body").value];
    if (b.rp_over_R) { sl.rp = slider($("rp"), b.rp_over_R[0], b.rp_over_R[1], true); sl.rp.kind = "R"; }
    else { sl.rp = slider($("rp"), b.altitude_km[0], b.altitude_km[1], true); sl.rp.kind = "alt"; }
    // The explorer lets v∞ go below the preset envelope, down to a near-parabolic 0.05 km/s.
    sl.vinf = slider($("vinf"), Math.min(0.05, b.v_inf_km_s[0]), b.v_inf_km_s[1], false);
    $("rp-label").textContent = sl.rp.kind === "R" ? "Periapsis radius" : "Periapsis altitude";
  }
  function engineRanges() {
    const e = D.engines[$("engine").value];
    const ispLo = e.isp_s[0], ispHi = e.isp_s[1] > ispLo ? e.isp_s[1] : ispLo * 1.05;
    sl.isp = slider($("isp"), ispLo, ispHi, false);
    sl.a0 = slider($("a0"), e.a0_m_s2[0], e.a0_m_s2[1], true);
  }
  function geoMid(s) { return s.log ? Math.sqrt(s.lo * s.hi) : 0.5 * (s.lo + s.hi); }

  sl.dv = slider($("dv"), DV_RANGE[0], DV_RANGE[1], true);
  sl.pi = slider($("pi"), 1e-3, 1e3, true);
  sl.vr = slider($("vr"), 1e-2, 10, true);
  sl.dvr = slider($("dvr"), 1e-3, 1, true);
  sl.lam = slider($("lam"), 1e-2, 3, true);

  // Example case: Hibberd et al. (2026) solar Oberth, approximated as a parabolic arrival with one
  // equivalent stage (same Δv and burn time as their two-stage stack; Phase 4 has the full model).
  function hibberd() {
    $("body").value = "sun"; bodyRanges(); sl.rp.set(3.2); sl.vinf.set(0.05);
    $("engine").value = "solid"; engineRanges(); sl.isp.set(286);
    const c = 286 * G0, dv = 8360, tb = 210.8;                    // Isp 286 s; 8.36 km/s in 210.8 s
    sl.dv.set(dv / 1e3);
    sl.a0 = slider($("a0"), Math.min(sl.a0.lo, 5), sl.a0.hi, true);
    sl.a0.set((c / tb) * -Math.expm1(-dv / c));
    $("case-note").hidden = false;
  }
  $("case").value = "hibberd"; hibberd();
  sl.pi.set(1.0); sl.vr.set(0.1); sl.dvr.set(0.03); sl.lam.set(0.3);

  // ---------- model inputs
  function mode() { return $("mode-nd").checked ? "nd" : "mission"; }
  function params() {
    if (mode() === "nd") {
      return { nd: S.fromTargets(sl.pi.get(), sl.vr.get(), sl.dvr.get(), sl.lam.get()), impact: S.R_FLOOR, mission: null };
    }
    const b = D.bodies[$("body").value];
    const r_p = sl.rp.kind === "R" ? sl.rp.get() * b.radius : b.radius + 1e3 * sl.rp.get();
    const V = Math.sqrt(b.gm / r_p), T = Math.sqrt(r_p ** 3 / b.gm), A = b.gm / r_p ** 2;
    const nd = { v_inf: 1e3 * sl.vinf.get() / V, dv: 1e3 * sl.dv.get() / V, c: sl.isp.get() * G0 / V, a0: sl.a0.get() / A };
    return { nd, impact: b.radius / r_p, mission: { b, r_p, V, T } };
  }
  function centroidOffset(nd) {
    const lam = nd.dv / nd.c, tb = (nd.c / nd.a0) * -Math.expm1(-lam);
    if (lam < 1e-8) return 0;
    const xbar = 1 / -Math.expm1(-lam) - 1 / lam;
    return tb * (0.5 - xbar);
  }

  // ---------- compute and render
  let last = null;
  function compute() {
    const p = params();
    const steering = $("steer-in").checked ? "inertial" : "prograde";
    const offset = $("place-dv").checked ? centroidOffset(p.nd) : 0;
    let res;
    try {
      res = S.simulate({ ...p.nd, steering, offset, impactRadius: p.impact, record: true });
    } catch (err) {
      res = { error: String(err.message || err) };
    }
    last = { p, res };
    updateOutputs(p);
    updateReadouts(p, res);
    drawAll();
    $("stage").classList.remove("busy");
  }
  let timer = null;
  function schedule() {
    updateOutputs(params());
    $("stage").classList.add("busy");
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(compute), 40);
  }

  function updateOutputs(p) {
    $("rp-out").textContent = sl.rp.kind === "R" ? `${sl.rp.get().toFixed(2)} R` : `${fmt(sl.rp.get(), 3)} km`;
    $("vinf-out").textContent = `${sl.vinf.get().toFixed(2)} km/s`;
    $("dv-out").textContent = `${fmt(sl.dv.get(), 3)} km/s`;
    $("isp-out").textContent = `${sl.isp.get().toFixed(0)} s`;
    $("a0-out").textContent = `${fmt(sl.a0.get(), 2)} m/s²`;
    $("pi-out").textContent = fmt(sl.pi.get(), 3);
    $("vr-out").textContent = fmt(sl.vr.get(), 3);
    $("dvr-out").textContent = fmt(sl.dvr.get(), 3);
    $("lam-out").textContent = fmt(sl.lam.get(), 3);
  }

  function updateReadouts(p, res) {
    const flag = $("r-flag");
    flag.hidden = true; flag.className = "chip";
    if (res.error) {
      $("r-eta").textContent = "–"; $("r-loss").textContent = "–"; $("r-loss-si").textContent = res.error;
      return;
    }
    const m = p.mission;
    $("r-eta").textContent = Number.isFinite(res.eta) ? res.eta.toFixed(res.eta > 0.999 && res.eta < 1 ? 6 : 4) : "–";
    $("r-loss").textContent = Number.isFinite(res.loss_rel) ? `${fmt(100 * res.loss_rel, 3)}%` : "–";
    $("r-loss-si").textContent = Number.isFinite(res.loss_rel)
      ? (m ? `of Δv: ${fmt(res.loss_rel * p.nd.dv * m.V, 3)} m/s` : "of Δv (equivalent Δv)") : "";
    $("r-pi").textContent = fmt(res.Pi, 3);
    $("r-tb").textContent = m ? `burn ${fmtDuration(res.t_b * m.T)}` : `t_b = ${fmt(res.t_b, 3)} √(r_p³/μ)`;
    if (Number.isFinite(res.v_inf_out)) {
      $("r-vout").textContent = m ? (res.v_inf_out * m.V / 1e3).toFixed(3) : fmt(res.v_inf_out, 4);
      $("r-vimp").textContent = m ? `km/s; impulsive ${(res.v_inf_imp * m.V / 1e3).toFixed(3)}` : `√(μ/r_p); impulsive ${fmt(res.v_inf_imp, 4)}`;
    } else {
      $("r-vout").textContent = "–"; $("r-vimp").textContent = res.captured ? "captured (bound after the burn)" : "";
    }
    $("r-rmin").textContent = m ? `${fmt(res.r_min * m.r_p / m.b.radius, 4)} R` : `${fmt(res.r_min, 4)} r_p`;
    if (res.impacted) { flag.hidden = false; flag.classList.add("bad"); flag.textContent = "impact"; }
    else if (m && m.b.soi) {
      const burn = res.segments.find((s) => s.burn), y = burn.y[0];
      const ratio = Math.hypot(y[0], y[1]) * m.r_p / m.b.soi;
      flag.hidden = false;
      if (ratio > 1) { flag.classList.add("bad"); flag.textContent = `burn starts outside the SOI (${fmt(ratio, 2)}×): model invalid`; }
      else { flag.classList.add("good"); flag.textContent = `burn inside the SOI (${fmt(ratio, 2)}× r_SOI)`; }
    }
  }

  // ---------- canvas helpers
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function setup(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function logAxes(ctx, box, xr, yr, opts) {
    const X = (v) => box.x + (Math.log10(v) - Math.log10(xr[0])) / (Math.log10(xr[1]) - Math.log10(xr[0])) * box.w;
    const Y = (v) => box.y + box.h - (Math.log10(v) - Math.log10(yr[0])) / (Math.log10(yr[1]) - Math.log10(yr[0])) * box.h;
    ctx.save();
    ctx.font = `11px ${css("--font-data")}`;
    ctx.fillStyle = css("--ink-2");
    ctx.strokeStyle = css("--grid"); ctx.lineWidth = 1;
    for (let e = Math.ceil(Math.log10(xr[0])); e <= Math.floor(Math.log10(xr[1])); e += opts.xStep || 1) {
      const x = X(10 ** e);
      ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke();
      ctx.textAlign = "center"; ctx.fillText(`10${sup(e)}`, x, box.y + box.h + 14);
    }
    for (let e = Math.ceil(Math.log10(yr[0])); e <= Math.floor(Math.log10(yr[1])); e += opts.yStep || 1) {
      const y = Y(10 ** e);
      ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(opts.yFmt ? opts.yFmt(e) : `10${sup(e)}`, box.x - 5, y + 4);
    }
    ctx.strokeStyle = css("--axis");
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.font = `12px ${css("--font-body")}`; ctx.fillStyle = css("--ink-2");
    ctx.textAlign = "center"; ctx.fillText(opts.xLabel, box.x + box.w / 2, box.y + box.h + 30);
    ctx.save(); ctx.translate(box.x - 40, box.y + box.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(opts.yLabel, 0, 0); ctx.restore();
    ctx.restore();
    return { X, Y };
  }

  // ---------- trajectory
  function drawTrajectory() {
    const { ctx, w, h } = setup($("cv-traj"));
    if (!last || last.res.error) return;
    const { p, res } = last;
    const burn = res.segments.find((s) => s.burn);
    let rb = 1;
    burn.y.forEach((y) => { rb = Math.max(rb, Math.hypot(y[0], y[1])); });
    const Rv = Math.min(Math.max(1.5 * rb, 3), 60);
    const scale = Math.min(w / (2.2 * Rv), h / (2 * Rv));
    const cx = w * 0.56, cy = h / 2;
    const P = (x, y) => [cx + x * scale, cy - y * scale];
    // rings
    ctx.save();
    ctx.font = `11px ${css("--font-data")}`; ctx.fillStyle = css("--muted");
    [1, 2, 5, 10, 20, 50].filter((r) => r <= Rv * 1.4).forEach((r) => {
      ctx.strokeStyle = css(r === 1 ? "--axis" : "--grid"); ctx.setLineDash(r === 1 ? [4, 4] : []);
      ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillText(r === 1 ? "r_p" : `${r} r_p`, cx + r * scale * 0.71 + 3, cy + r * scale * 0.71 + 12);
    });
    ctx.setLineDash([]);
    // central body
    const Rb = p.mission ? p.impact : 0.03;
    ctx.fillStyle = p.mission && p.mission.b.name === "Sun" ? css("--sun") : css("--muted");
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(Rb * scale, 3), 0, 2 * Math.PI); ctx.fill();
    // unpowered arrival hyperbola (r = p/(1 + e cos θ), periapsis on +x)
    const e = 1 + p.nd.v_inf ** 2, pp = 1 + e, thMax = Math.acos(-1 / e) * 0.995;
    ctx.strokeStyle = css("--muted"); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 400; i++) {
      const th = -thMax + 2 * thMax * i / 400, r = pp / (1 + e * Math.cos(th));
      if (r > 3 * Rv) { pen = false; continue; }
      const [X, Y] = P(r * Math.cos(th), r * Math.sin(th));
      if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
    }
    ctx.stroke(); ctx.setLineDash([]);
    // flown trajectory
    res.segments.forEach((s) => {
      ctx.strokeStyle = s.burn ? css("--accent") : css("--ink-2");
      ctx.lineWidth = s.burn ? 4 : 1.6; ctx.lineCap = "round";
      ctx.beginPath();
      s.y.forEach((y, i) => { const [X, Y] = P(y[0], y[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    });
    // A burn shorter than a few pixels on screen gets a ring, so it stays visible.
    const b0 = P(burn.y[0][0], burn.y[0][1]), b1 = P(burn.y[burn.y.length - 1][0], burn.y[burn.y.length - 1][1]);
    if (Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) < 8) {
      ctx.strokeStyle = css("--accent"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, 7, 0, 2 * Math.PI); ctx.stroke();
    }
    // legend
    ctx.font = `12px ${css("--font-body")}`; ctx.textAlign = "left"; ctx.lineCap = "butt";
    [["burn", css("--accent"), 4, []], ["coast", css("--ink-2"), 1.6, []], ["unpowered arrival", css("--muted"), 1.2, [5, 4]]]
      .forEach(([lab, col, lw, dash], k) => {
        const y = 16 + 18 * k;
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(34, y); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = css("--ink-2"); ctx.fillText(lab, 40, y + 4);
      });
    ctx.fillStyle = css("--muted");
    ctx.fillText(`view ±${fmt(Rv, 2)} r_p`, 10, h - 10);
    ctx.restore();
  }

  // ---------- loss vs Π
  function drawLoss() {
    const { ctx, w, h } = setup($("cv-loss"));
    const box = { x: 56, y: 12, w: w - 70, h: h - 56 };
    const xr = [1e-3, 1e3], yr = [1e-6, 100];
    const { X, Y } = logAxes(ctx, box, xr, yr, { xLabel: "Π", yLabel: "loss  [% of Δv]", yStep: 2,
      yFmt: (e) => (e >= 0 ? `${10 ** e}` : `10${sup(e)}`) });
    const c = D.curve;
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.fillStyle = css("--axis"); ctx.globalAlpha = 0.6;
    ctx.beginPath();
    c.Pi.forEach((v, i) => { const [x, y] = [X(v), Y(100 * c.hi[i])]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = c.Pi.length - 1; i >= 0; i--) ctx.lineTo(X(c.Pi[i]), Y(100 * c.lo[i]));
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = css("--ink-2"); ctx.lineWidth = 1.2; ctx.beginPath();
    c.Pi.forEach((v, i) => { const [x, y] = [X(v), Y(100 * c.mid[i])]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.strokeStyle = css("--ink"); ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath();
    [1e-3, 3].forEach((v, i) => { const [x, y] = [X(v), Y(100 * v * v / 96)]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([2, 3]); ctx.strokeStyle = css("--muted"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(box.x, Y(1)); ctx.lineTo(box.x + box.w, Y(1)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `11px ${css("--font-body")}`; ctx.fillStyle = css("--ink-2"); ctx.textAlign = "left";
    ctx.fillText("1% of Δv", box.x + 4, Y(1) - 4);
    ctx.fillText("Π²/96", X(0.004), Y(100 * 0.004 ** 2 / 96) - 8);
    if (last && !last.res.error && Number.isFinite(last.res.loss_rel) && last.res.loss_rel > 0) {
      const px = X(Math.min(Math.max(last.res.Pi, xr[0]), xr[1]));
      const py = Y(Math.min(Math.max(100 * last.res.loss_rel, yr[0]), yr[1]));
      ctx.fillStyle = css("--accent"); ctx.strokeStyle = css("--bg"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- atlas
  function hexRgb(hex) {
    const v = parseInt(hex.replace("#", ""), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  let rampCache = null;
  function rampColor(t) {                           // one hue, light → dark, linearly interpolated
    const stops = rampCache || (rampCache = [0, 1, 2, 3, 4, 5, 6].map((i) => hexRgb(css(`--ramp-${i}`))));
    t = Math.min(Math.max(t, 0), 1) * 6;
    const i = Math.min(Math.floor(t), 5), f = t - i;
    const c = stops[i].map((a, k) => Math.round(a + f * (stops[i + 1][k] - a)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function drawAtlas() {
    const { ctx, w, h } = setup($("cv-atlas"));
    const box = { x: 56, y: 12, w: w - 92, h: h - 56 };
    const A = D.atlas, xr = [A.Pi[0], A.Pi[A.Pi.length - 1]], yr = [A.v_over_vesc[0], A.v_over_vesc[A.v_over_vesc.length - 1]];
    const lx = A.Pi.map(Math.log10), ly = A.v_over_vesc.map(Math.log10);
    const X = (v) => box.x + (Math.log10(v) - lx[0]) / (lx[lx.length - 1] - lx[0]) * box.w;
    const Y = (v) => box.y + box.h - (Math.log10(v) - ly[0]) / (ly[ly.length - 1] - ly[0]) * box.h;
    const edge = (arr, i) => (i <= 0 ? arr[0] : i >= arr.length ? arr[arr.length - 1] : Math.sqrt(arr[i - 1] * arr[i]));
    for (let j = 0; j < A.v_over_vesc.length; j++) {
      for (let i = 0; i < A.Pi.length; i++) {
        const x0 = X(edge(A.Pi, i)), x1 = X(edge(A.Pi, i + 1)), y0 = Y(edge(A.v_over_vesc, j + 1)), y1 = Y(edge(A.v_over_vesc, j));
        ctx.fillStyle = rampColor(A.eta[j][i]);
        ctx.fillRect(x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5);
      }
    }
    logAxes(ctx, box, xr, yr, { xLabel: "Π", yLabel: "v∞ / v_esc" });
    // colour bar
    const cb = { x: box.x + box.w + 10, y: box.y, w: 10, h: box.h };
    for (let k = 0; k < 60; k++) { ctx.fillStyle = rampColor(1 - k / 59); ctx.fillRect(cb.x, cb.y + k * cb.h / 60, cb.w, cb.h / 60 + 0.5); }
    ctx.font = `11px ${css("--font-data")}`; ctx.fillStyle = css("--ink-2"); ctx.textAlign = "left";
    ctx.fillText("1", cb.x + cb.w + 3, cb.y + 9);
    ctx.fillText("0", cb.x + cb.w + 3, cb.y + cb.h);
    ctx.fillText("η", cb.x + cb.w + 3, cb.y + cb.h / 2 + 4);
    if (last && !last.res.error) {
      const vr = last.p.nd.v_inf / Math.SQRT2;
      const inside = last.res.Pi >= xr[0] && last.res.Pi <= xr[1] && vr >= yr[0] && vr <= yr[1];
      const px = X(Math.min(Math.max(last.res.Pi, xr[0]), xr[1])), py = Y(Math.min(Math.max(vr, yr[0]), yr[1]));
      ctx.lineWidth = 2.5; ctx.strokeStyle = css("--bg");
      ctx.beginPath(); ctx.arc(px, py, 8, 0, 2 * Math.PI); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = inside ? css("--ink") : css("--critical");
      ctx.beginPath(); ctx.arc(px, py, 8, 0, 2 * Math.PI); ctx.stroke();
    }
  }

  function drawAll() { rampCache = null; drawTrajectory(); drawLoss(); drawAtlas(); }

  // ---------- wiring
  function setMode() {
    const nd = mode() === "nd";
    $("mission-inputs").hidden = nd; $("nd-inputs").hidden = !nd;
    schedule();
  }
  $("controls").addEventListener("submit", (e) => e.preventDefault());
  $("controls").addEventListener("input", (e) => {
    if (e.target.id === "case") {
      if ($("case").value === "hibberd") hibberd(); else $("case-note").hidden = true;
      return schedule();
    }
    if (["body", "rp", "vinf", "dv", "engine", "isp", "a0"].includes(e.target.id)) {
      $("case").value = "custom"; $("case-note").hidden = true;         // any edit leaves the example case
    }
    if (e.target.id === "body") { bodyRanges(); sl.rp.set(geoMid(sl.rp)); sl.vinf.set(geoMid(sl.vinf)); }
    if (e.target.id === "engine") { engineRanges(); sl.isp.set(geoMid(sl.isp)); sl.a0.set(geoMid(sl.a0)); }
    if (e.target.name === "mode") return setMode();
    schedule();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawAll);
  new MutationObserver(drawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  let rz = null;
  new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(drawAll, 60); }).observe(document.querySelector(".stage"));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
  schedule();
})();
