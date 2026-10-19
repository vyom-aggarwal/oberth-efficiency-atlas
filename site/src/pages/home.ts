// The home page: the shell, the sticky section navigation, and the figures, each loaded when it nears the
// viewport (data for figures below the fold is lazy-loaded with its code).
import { initShell } from "./shell";
import { loadBinary, loadData, type SiteData } from "../lib/data";
import { h } from "../lib/dom";
import { referenceHTML, sourceLink } from "../lib/cite";
import { sig } from "../lib/format";

initShell("home");

// ---------------------------------------------------------------- section navigation
const links = new Map<string, HTMLAnchorElement[]>();
for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
  const id = a.dataset.nav!;
  links.set(id, [...(links.get(id) ?? []), a]);
}
const currentLabel = document.querySelector<HTMLElement>("[data-current-section]");
const mobileNav = document.querySelector<HTMLDetailsElement>(".section-nav-mobile");
function setCurrent(id: string): void {
  for (const [key, anchors] of links) for (const a of anchors) {
    if (key === id) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
  if (currentLabel) currentLabel.textContent = links.get(id)?.[0]?.textContent ?? "";
}
const visible = new Map<string, number>();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
  const best = [...visible.entries()].filter(([id, r]) => r > 0 && links.has(id)).sort((a, b) => b[1] - a[1])[0];
  if (best) setCurrent(best[0]);
}, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.01, 0.25, 0.5, 1] });
for (const s of document.querySelectorAll<HTMLElement>("section[data-section]")) if (s.id !== "hero") io.observe(s);
mobileNav?.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("a")) mobileNav.open = false;
});
// Keep scroll targets and focused controls clear of the sticky section bar (narrow screens, author 2026-10-18):
// --sticky-top, which sets scroll-padding-top, follows the bar's closed height (its title can wrap). The summary is
// observed rather than the bar, so an open list does not count.
const barTitle = mobileNav?.querySelector("summary");
if (mobileNav && barTitle) new ResizeObserver(() => {
  const cs = getComputedStyle(mobileNav);
  const height = cs.display === "none" ? 0
    : barTitle.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
  document.documentElement.style.setProperty("--sticky-top", `${Math.ceil(height)}px`);
}).observe(barTitle);

// ---------------------------------------------------------------- figures
type Mount = (body: HTMLElement, figN: number) => Promise<void>;
const FIGURES: Record<string, Mount> = {
  hero: async (body, figN) => {
    const [{ hero }, site, data] = await Promise.all([
      import("../charts/hero"), loadData<SiteData>("site.json"), loadData<any>("hero.json")]);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    hero(body, data, site, { figN, reducedMotion });
  },
  "universal-curve": async (body, figN) => {
    const [{ universalCurve }, site, curve] = await Promise.all([
      import("../charts/universal-curve"), loadData<SiteData>("site.json"), loadData<any>("curve.json")]);
    universalCurve(body, curve, site, { figN, title: "Loss as a fraction of Δv against Π" });
  },
  regimes: async (body, figN) => {
    const [{ regimes }, site, data] = await Promise.all([
      import("../charts/regimes"), loadData<SiteData>("site.json"), loadData<any>("regimes.json")]);
    regimes(body, data, site, { figN, title: "Three regimes of η_W against Π" });
  },
  atlas: async (body, figN) => {
    const [{ atlas }, site, data, missions] = await Promise.all([
      import("../charts/atlas"), loadData<SiteData>("site.json"), loadData<any>("atlas.json"), loadData<any>("missions.json")]);
    atlas(body, data, missions, site, { figN, title: "The atlas: η over Π and arrival speed" });
  },
  timing: async (body, figN) => {
    const [{ timing }, site, data] = await Promise.all([
      import("../charts/timing"), loadData<SiteData>("site.json"), loadData<any>("timing.json")]);
    timing(body, data, site, { figN, title: "When to fire: the thrust profile of a rocket burn" });
  },
  case: async (body, figN) => {
    const [{ caseStudy }, site, data] = await Promise.all([
      import("../charts/case"), loadData<SiteData>("site.json"), loadData<any>("case.json")]);
    caseStudy(body, data, site, { figN, title: "How much thrust Hibberd et al.'s burn can lose" });
  },
  engines: async (body, figN) => {
    const [{ engines }, site, data] = await Promise.all([
      import("../charts/engines"), loadData<SiteData>("site.json"), loadData<any>("engines.json")]);
    const buf = await loadBinary(data.binary);
    engines(body, data, buf, site, { figN, title: "One dive, three engines" });
  },
  limitations: async (body) => {
    // One figure-free number for the Limitations section (plan §1): the J2 sensitivity, from j2_numbers.json.
    const [site, m] = await Promise.all([loadData<SiteData>("site.json"), loadData<any>("methods.json")]);
    const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    body.append(h("dl", { class: "facts" },
      row("J2 oblateness, largest change in η", sig(m.j2_max_abs_delta_eta.value, 2)),
      row("J2 oblateness, largest relative change in the deficit 1 − η", `${sig(100 * m.j2_max_rel_delta_deficit.value, 2)} %`),
      row("Source", sourceLink(site, "figures/j2_numbers.json"))));
  },
  references: async (body) => {
    const site = await loadData<SiteData>("site.json");
    body.append(h("ol", { class: "references" }, ...site.references.map((r) =>
      h("li", { id: `ref-${r.n}`, value: r.n, html: referenceHTML(r.text) }))));
  },
  methods: async (body) => {
    const [site, m] = await Promise.all([loadData<SiteData>("site.json"), loadData<any>("methods.json")]);
    const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    body.append(h("dl", { class: "facts" },
      row("Analysis tag", h("a", { href: `${site.repo.url}/tree/${m.tag}`, rel: "noopener" }, `${m.tag} (commit ${m.tag_commit})`)),
      row("Tests in the suite", String(m.tests_collected)),
      row("Π²/96 rule, largest ratio for Π ≤ 1", sig(m.rule_max_ratio_Pi_le_1.value, 4)),
      row("J2 oblateness, largest change in η", sig(m.j2_max_abs_delta_eta.value, 2)),
      row("Rebuild and audit", h("a", { href: `${site.repo.url}/blob/main/${m.repro_doc}`, rel: "noopener" }, m.repro_doc))));
  },
};

function placeholder(body: HTMLElement, name: string): void {
  body.append(h("p", { class: "figure-pending" }, `Figure "${name}" is built at a later checkpoint.`));
}

const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    const fig = e.target as HTMLElement;
    const body = fig.querySelector<HTMLElement>(".figure-body")!;
    const name = fig.dataset.figure!;
    const mount = FIGURES[name];
    if (!mount) {
      if (import.meta.env.DEV) placeholder(body, name);
      continue;
    }
    mount(body, Number(fig.dataset.figN ?? 0)).catch((err) => {
      console.error(err);
      body.append(h("p", { class: "figure-error", role: "alert" }, "This figure could not load its data. Reload the page to try again."));
    });
  }
}, { rootMargin: "600px 0px" });
for (const fig of document.querySelectorAll<HTMLElement>("figure[data-figure]")) lazy.observe(fig);
