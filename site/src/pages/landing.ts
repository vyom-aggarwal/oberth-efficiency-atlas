// The landing page (/, Phase 7; docs/landing_plan.md as approved 2026-10-21): the three-engine hero at once, the
// three findings when they near the viewport (their data, the atlas's included, lazy-loaded with their code), and the
// reproducibility and scope facts from methods.json. The author's prose slots and the findings' links are built into
// the HTML by the content plugin.
import "../styles/landing.css";
import { initShell } from "./shell";
import { loadBinary, loadData, type SiteData } from "../lib/data";
import { h } from "../lib/dom";

initShell("landing");

const BODY_NAMES: Record<string, string> = { sun: "Sun", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" };

async function hero(): Promise<void> {
  const root = document.getElementById("landing-hero")!;
  const body = root.querySelector<HTMLElement>(".landing-hero-body")!;
  const [{ landingHero }, site, data] = await Promise.all([
    import("../charts/landing-hero"), loadData<SiteData>("site.json"), loadData<any>("engines.json")]);
  const buf = await loadBinary(data.binary);
  landingHero(root, body, data, buf, site, { reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
}

type Mount = (body: HTMLElement) => Promise<void>;
const FINDINGS: Record<string, Mount> = {
  loss: async (body) => {
    const [{ lossFinding }, site, curve, engines] = await Promise.all([
      import("../charts/findings"), loadData<SiteData>("site.json"), loadData<any>("curve.json"), loadData<any>("engines.json")]);
    lossFinding(body, curve, engines, site);
  },
  missions: async (body) => {
    const [{ missionsFinding }, site, atlas, missions] = await Promise.all([
      import("../charts/findings"), loadData<SiteData>("site.json"), loadData<any>("atlas.json"), loadData<any>("missions.json")]);
    missionsFinding(body, atlas, missions, site);
  },
  hibberd: async (body) => {
    const [{ hibberdFinding }, site, data] = await Promise.all([
      import("../charts/findings"), loadData<SiteData>("site.json"), loadData<any>("case.json")]);
    hibberdFinding(body, data, site);
  },
};

async function repro(body: HTMLElement): Promise<void> {
  const [site, m] = await Promise.all([loadData<SiteData>("site.json"), loadData<any>("methods.json")]);
  const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
  const a = m.audit;
  body.append(h("dl", { class: "facts" },
    row("Fresh-clone audit", `${a.identical.value} of ${a.outputs.value} outputs reproduced identically (commit ${a.audited_commit.value}, ${a.date.value})`),
    row("Tests", `${m.tests_collected} in the suite; ${a.tests_passed.value} passed in the audited clone`),
    row("Analysis tag", h("a", { href: `${site.repo.url}/tree/${m.tag}`, rel: "noopener" }, `${m.tag} (commit ${m.tag_commit})`)),
    row("Sweep", `${Number(m.scope.sweep_rows.value).toLocaleString("en-GB")} simulated flybys`),
    row("Engines", m.scope.engines.map((e: { value: string }) => e.value).join(", ")),
    row("Bodies", Object.keys(m.scope.bodies.value).map((b) => BODY_NAMES[b] ?? b).join(", ")),
    row("Rebuild and audit", h("a", { href: `${site.repo.url}/blob/main/${m.repro_doc}`, rel: "noopener" }, m.repro_doc))));
}

hero().catch((err) => {
  console.error(err);
  document.querySelector(".landing-hero-body")?.append(h("p", { class: "figure-error", role: "alert" }, "This figure could not load its data. Reload the page to try again."));
});

const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    const el = e.target as HTMLElement;
    const run = el.dataset.finding ? FINDINGS[el.dataset.finding](el.querySelector<HTMLElement>(".finding-body")!)
      : repro(el.querySelector<HTMLElement>(".repro-body")!);
    run.catch((err) => {
      console.error(err);
      el.append(h("p", { class: "figure-error", role: "alert" }, "This figure could not load its data. Reload the page to try again."));
    });
  }
}, { rootMargin: "600px 0px" });
for (const el of document.querySelectorAll<HTMLElement>("figure[data-finding], .landing-repro")) lazy.observe(el);
