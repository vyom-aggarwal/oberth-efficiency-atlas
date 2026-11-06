// The About page (/about/; Phase 9 pass 6, docs/revamp_plan.md §2.4): how to cite the project, its licences with the
// design credit and the portfolio's MIT notice (quoted at build time from THIRD_PARTY_NOTICES.md), the fresh-clone
// audit, and the author's slots. The citation, BibTeX and notice are built into the HTML by the content plugin; this
// adds the reproducibility facts from methods.json.
import { initShell } from "./shell";
import "../styles/pages.css";                     // after the shell's sheets
import { loadData, type SiteData } from "../lib/data";
import { h } from "../lib/dom";

initShell("about");

(async () => {
  const [site, m] = await Promise.all([loadData<SiteData>("site.json"), loadData<any>("methods.json")]);
  const a = m.audit;
  const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
  document.getElementById("about-repro")!.append(
    row("Fresh-clone audit", `${a.identical.value} of ${a.outputs.value} outputs reproduced identically (commit ${a.audited_commit.value}, ${a.date.value})`),
    row("Tests", `${m.tests_collected} in the suite; ${a.tests_passed.value} passed in the audited clone`),
    row("Analysis tag", h("a", { href: `${site.repo.url}/tree/${m.tag}`, rel: "noopener" }, `${m.tag} (commit ${m.tag_commit})`)),
    row("Rebuild and audit", h("a", { href: `${site.repo.url}/blob/main/${m.repro_doc}`, rel: "noopener" }, m.repro_doc)));
})().catch((err) => console.error(err));
