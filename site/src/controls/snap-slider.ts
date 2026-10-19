// A slider over a fixed list of values (e.g. the 15 sweep values of v∞/v_esc): a native range input over the
// indices, so keyboard, touch and screen readers work unchanged, with the current value printed beside it.
import { h } from "../lib/dom";
import { signal, type Signal } from "../lib/signal";

export interface SnapSliderOptions {
  id: string;
  label: Node | string;
  values: number[];
  index: number;
  /** The value as printed beside the slider and read out as aria-valuetext. */
  format: (v: number) => string;
}

export function snapSlider(o: SnapSliderOptions): { el: HTMLElement; index: Signal<number> } {
  const index = signal(o.index);
  const range = h("input", { type: "range", id: o.id, min: 0, max: o.values.length - 1, step: 1, value: o.index });
  const out = h("output", { class: "snap-value", for: o.id });
  const el = h("div", { class: "snap-slider" }, h("label", { class: "slider-label", for: o.id }, o.label), range, out);
  range.addEventListener("input", () => index.set(Number(range.value)));
  index.subscribe((i) => {
    if (Number(range.value) !== i) range.value = String(i);
    const text = o.format(o.values[i]);
    range.setAttribute("aria-valuetext", text);
    out.textContent = text;
  });
  return { el, index };
}
