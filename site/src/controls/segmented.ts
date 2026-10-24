// Segmented choice: a native radio group styled as pills (the classic explorer's), the radio dot visible.
import { h } from "../lib/dom";
import type { Signal } from "../lib/signal";

export function segmented<T extends string>(name: string, legend: string, options: [T, string][], state: Signal<T>): HTMLFieldSetElement {
  const fs = h("fieldset", { class: "segmented" }, h("legend", {}, legend));
  for (const [value, text] of options) {
    const input = h("input", { type: "radio", name, value });
    input.addEventListener("change", () => input.checked && state.set(value));
    fs.append(h("label", {}, input, text));
  }
  state.subscribe((v) => {
    for (const input of fs.querySelectorAll<HTMLInputElement>("input")) input.checked = input.value === v;
  });
  return fs;
}
