// The explorer's trajectory view: a canvas in the hero's convention (periapsis down), the burn on the Burn ramp by
// a·v, the impulsive exit dashed. Zoom and pan by wheel or pinch, drag, and keys (+ − arrows, 0 resets).
import type { FlybyPath, Pt } from "../sim/paths";
import { cssVar, themeShown } from "../lib/theme";

export interface Scene {
  path: FlybyPath;
  impulsive: Pt[];
  /** Body radius in r_p (drawn when it is a real body), or null. */
  bodyRadius: number | null;
  /** log₁₀ a·v (simulator units) at the two ends of the colour ramp. */
  avLog: [number, number];
  label: string;
}

const MIN_ZOOM = 0.05, MAX_ZOOM = 400;                    // relative to the default view

export function trajectoryView(canvas: HTMLCanvasElement): { setScene: (sc: Scene) => void; reset: () => void } {
  let scene: Scene | null = null;
  let W = 0, H = 0, base = 1, scale = 1, cx = 0, cy = 0, moved = false;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");

  /** The default view: the hero's framing, periapsis 56 px above the bottom edge. */
  function reset(): void {
    const narrow = W < 640;
    const U = narrow ? 2.9 : 7.2;
    base = scale = W / (2 * U);
    const xBot = 1 + 56 / scale;
    cx = xBot - H / (2 * scale);
    cy = 0;
    moved = false;
    draw();
  }
  const toScreen = (p: { x: number; y: number }): [number, number] => [W / 2 + (p.y - cy) * scale, H / 2 + (p.x - cx) * scale];
  function zoomAt(px: number, py: number, f: number): void {
    const wx = cx + (py - H / 2) / scale, wy = cy + (px - W / 2) / scale;
    scale = Math.min(base * MAX_ZOOM, Math.max(base * MIN_ZOOM, scale * f));
    cx = wx - (py - H / 2) / scale;
    cy = wy - (px - W / 2) / scale;
    moved = true;
    draw();
  }
  function pan(dx: number, dy: number): void {
    cy -= dx / scale; cx -= dy / scale;
    moved = true;
    draw();
  }

  function draw(): void {
    if (!W) return;
    canvas.dataset.zoom = (scale / base).toFixed(3);
    canvas.dataset.centre = `${cx.toFixed(4)},${cy.toFixed(4)}`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cssVar("--bg"); ctx.fillRect(0, 0, W, H);
    if (!scene) return;
    canvas.setAttribute("aria-label", scene.label);
    const ink = cssVar("--ink"), graphite = cssVar("--ink-2"), rule = cssVar("--grid");
    const [ox, oy] = toScreen({ x: 0, y: 0 });
    ctx.setLineDash([2, 4]); ctx.strokeStyle = rule; ctx.lineWidth = 1;          // periapsis distance
    ctx.beginPath(); ctx.arc(ox, oy, scale, 0, 2 * Math.PI); ctx.stroke();
    ctx.setLineDash([]);
    if (scene.bodyRadius && scene.bodyRadius * scale > 1) {
      ctx.fillStyle = rule; ctx.strokeStyle = graphite;
      ctx.beginPath(); ctx.arc(ox, oy, scene.bodyRadius * scale, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    const stroke = (pts: Pt[]) => {
      ctx.beginPath();
      pts.forEach((p, i) => { const [x, y] = toScreen(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    };
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = graphite; ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
    stroke(scene.impulsive);
    ctx.setLineDash([]);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
    stroke(scene.path.pre); stroke(scene.path.post);
    // The burn, coloured by a·v (a burn shorter than a few pixels is a dot).
    const b = scene.path.burn;
    if (!b.length) return;                                  // an impact before the burn
    const [lo, hi] = scene.avLog;
    const colour = (av: number) => cssVar(`--av-${1 + Math.round(Math.min(1, Math.max(0, hi > lo ? (Math.log10(av) - lo) / (hi - lo) : 1)) * 6)}`);
    const [ax, ay] = toScreen(b[0]), [bx, by] = toScreen(b[b.length - 1]);
    if (Math.hypot(bx - ax, by - ay) < 5) {
      ctx.fillStyle = colour(b[0].av!);
      ctx.beginPath(); ctx.arc(ax, ay, 4, 0, 2 * Math.PI); ctx.fill();
    } else {
      ctx.lineWidth = 5;
      for (let i = 0; i + 1 < b.length; i++) {
        ctx.strokeStyle = colour(b[i].av!);
        const [x0, y0] = toScreen(b[i]), [x1, y1] = toScreen(b[i + 1]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
  }

  // ---------------------------------------------------------------- input
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  const pointers = new Map<number, { x: number; y: number }>();
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 1) {
      pan(e.clientX - prev.x, e.clientY - prev.y);
    } else if (pointers.size === 2) {                         // pinch: scale about the midpoint
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const r = canvas.getBoundingClientRect();
      if (d0 > 0) zoomAt((e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top, d1 / d0);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const lift = (e: PointerEvent) => pointers.delete(e.pointerId);
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("keydown", (e) => {
    const step = 40;
    const act: Record<string, () => void> = {
      "+": () => zoomAt(W / 2, H / 2, 1.25), "=": () => zoomAt(W / 2, H / 2, 1.25),
      "-": () => zoomAt(W / 2, H / 2, 0.8), "_": () => zoomAt(W / 2, H / 2, 0.8),
      ArrowLeft: () => pan(step, 0), ArrowRight: () => pan(-step, 0), ArrowUp: () => pan(0, step), ArrowDown: () => pan(0, -step),
      "0": reset,
    };
    if (act[e.key]) { e.preventDefault(); act[e.key](); }
  });

  new ResizeObserver(() => {
    const w = Math.round(canvas.parentElement!.clientWidth);
    if (w === W) return;
    const ratio = W ? w / W : 1;
    W = w;
    H = Math.round(W < 640 ? W * 0.95 : Math.min(560, Math.max(360, W * 0.6)));
    if (!moved) reset();
    else { base *= ratio; scale *= ratio; draw(); }
  }).observe(canvas.parentElement!);
  themeShown.subscribe(() => requestAnimationFrame(draw));

  return { setScene: (sc) => { scene = sc; draw(); }, reset };
}
