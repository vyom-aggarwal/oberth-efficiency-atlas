// The explorer page (built at checkpoint 5). For now: the shell and the layout regions.
import { initShell } from "./shell";
import { h } from "../lib/dom";

initShell("explorer");
if (import.meta.env.DEV) {
  document.querySelector(".explorer-view")?.append(h("p", { class: "figure-pending" }, "The explorer is built at checkpoint 5."));
}
