// A·v colouring drawn one path per same-colour run (Phase 8, fix 6; author, 2026-10-26). Stroked segment by segment,
// a burn's short segments overlap at their anti-aliased ends, so a short run of one colour never reaches that colour
// on screen (the landing hero's SEP lane faded that way; e2e/av-stroke.spec.ts measures the rendered pixels).

/**
 * Strokes the polyline through points 0…n−1 with segment i (point i to point i+1) in ramp step `step(i)`, or not at all
 * where it is null. Consecutive segments in one step make one path, in `colour(step)`. Returns the steps drawn.
 */
export function strokeRuns(ctx: CanvasRenderingContext2D, n: number, step: (i: number) => number | null,
                           point: (i: number) => [number, number], colour: (step: number) => string): Set<number> {
  const drawn = new Set<number>();
  let current: number | null = null;
  const flush = () => { if (current !== null) ctx.stroke(); current = null; };
  for (let i = 0; i + 1 < n; i++) {
    const k = step(i);
    if (k !== current) {
      flush();
      if (k === null) continue;
      current = k;
      drawn.add(k);
      ctx.strokeStyle = colour(k);
      ctx.beginPath();
      ctx.moveTo(...point(i));
    }
    ctx.lineTo(...point(i + 1));
  }
  flush();
  return drawn;
}
