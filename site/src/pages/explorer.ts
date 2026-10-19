// The explorer page: the shell, then the explorer once its data has loaded (presets, the hero's case for the
// Hibberd preset, and the universal curve for placement).
import { initShell } from "./shell";
import { explorer, type ExplorerData } from "../explorer/explorer";
import { loadData } from "../lib/data";
import { h } from "../lib/dom";

initShell("explorer");
const root = document.querySelector<HTMLElement>("[data-explorer]")!;
Promise.all([loadData<ExplorerData["presets"]>("presets.json"), loadData<ExplorerData["hero"]>("hero.json"), loadData<ExplorerData["curve"]>("curve.json")])
  .then(([presets, hero, curve]) => explorer(root, { presets, hero, curve }))
  .catch((err) => {
    console.error(err);
    root.prepend(h("p", { class: "figure-error", role: "alert" }, "The explorer could not load its data. Reload the page to try again."));
  });
