// The landing page (Phase 7; docs/landing_plan.md as approved 2026-10-21), against the test build: no console errors
// and no sideways scrolling at four widths; the hero's sequence (once per browser session, skipped under reduced
// motion), scrubbing, and the SEP caveat; the entry links; the three findings; the reproducibility facts and the
// footer's citation. The production build's checks (the Research link, links under the base path, above the fold)
// are in prod.spec.ts.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

const data = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));

async function open(page: Page, width: number, reducedMotion = true): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
  await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  await page.goto("");
  await expect(page.locator(".lh-dive")).toBeVisible();
  return errors;
}

for (const width of [360, 390, 768, 1440]) {
  test(`landing at ${width}px: no console errors, no sideways scrolling, every part drawn, the SEP caveat visible`, async ({ page }) => {
    const errors = await open(page, width);
    await page.evaluate(async () => {                                 // reach the lazily loaded parts
      for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    });
    await expect(page.locator(".finding svg[role=img]")).toHaveCount(3);
    await expect(page.locator(".landing-repro dl.facts dt")).toHaveCount(7);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);
    await expect(page.locator(".lh-note")).toHaveText("* hypothetical at 3.2 R☉");
    await expect(page.locator(".lh-note")).toBeVisible();
    await expect(page.locator(".lh-dive"), "the lane labels fit inside the view").toHaveAttribute("data-labels-clipped", "0");
    // Each legend item once: the narrow key and the full one are never both shown.
    const shown = await page.locator(".lh-side li:visible").allTextContents();
    expect(shown.filter((t) => /impulsive/.test(t)).length).toBe(1);
    expect(errors).toEqual([]);
  });
}

test("the hero sequence runs once per browser session, then shows the final frame", async ({ page }) => {
  await open(page, 1440, false);
  const hero = page.locator("#landing-hero");
  await expect(hero).toHaveAttribute("data-intro", "running");
  await expect(hero).toHaveAttribute("data-intro", "done", { timeout: 4000 });       // at most 3 s (plus slack)
  await expect(hero).toHaveAttribute("data-intro-runs", "1");
  await expect(page.locator(".lh-controls .clock")).toHaveText(/^t = \+/);              // ended on the final frame
  await page.reload();                                                                 // same session
  await expect(hero).toHaveAttribute("data-intro", "seen");
  expect(await hero.getAttribute("data-intro-runs")).toBeNull();
});

test("the sequence lasts at most 3 s", async ({ page }) => {
  await open(page, 1440, false);
  const ms = await page.evaluate(() => new Promise<number>((resolve) => {
    const hero = document.getElementById("landing-hero")!, t0 = performance.now();
    const check = () => (hero.dataset.intro === "done" ? resolve(performance.now() - t0) : requestAnimationFrame(check));
    check();
  }));
  expect(ms).toBeLessThanOrEqual(3000);
});

test("under prefers-reduced-motion the final frame is drawn at once, with no sequence", async ({ page }) => {
  await open(page, 1440, true);
  const hero = page.locator("#landing-hero");
  await expect(hero).toHaveAttribute("data-intro", "skipped");
  expect(await hero.getAttribute("data-intro-runs")).toBeNull();
  await expect(page.locator(".lh-controls .clock")).toHaveText(/^t = \+/);
});

test("any reader input ends the sequence on the final frame", async ({ page }) => {
  await open(page, 1440, false);
  const hero = page.locator("#landing-hero");
  await expect(hero).toHaveAttribute("data-intro", "running");
  await page.keyboard.press("Tab");
  await expect(hero).toHaveAttribute("data-intro", "done");
  await expect(page.locator(".lh-controls .clock")).toHaveText(/^t = \+/);
});

test("scrubbing moves the clock, the paths and the strip's cursor", async ({ page }) => {
  await open(page, 1440);
  const cursor = await page.locator("#landing-hero").getAttribute("data-cursor");
  const k = await page.locator(".lh-dive").getAttribute("data-k");
  await page.locator("#hero-t").focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".lh-controls .clock")).toHaveText(/^t = −/);
  expect(await page.locator("#landing-hero").getAttribute("data-cursor")).not.toBe(cursor);
  expect(await page.locator(".lh-dive").getAttribute("data-k")).not.toBe(k);
  await expect(page.locator("#hero-t")).toHaveAttribute("aria-valuetext", /from perihelion/);
});

test("every entry link resolves", async ({ page }) => {
  await open(page, 1440);
  const links = page.locator(".entry-links a");
  await expect(links).toHaveText(["Read the research", "Open the explorer", "View the source on GitHub"]);   // the test build shows the article
  for (const href of await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))) {
    if (new URL(href).host !== "site.test") { expect(href).toMatch(/^https:\/\/github\.com\//); continue; }
    expect((await page.goto(href))!.status(), href).toBe(200);
  }
});

test("the findings: titles, live figures with readouts, and one link each", async ({ page }) => {
  await open(page, 1440);
  const findings = page.locator("figure.finding");
  await expect(findings).toHaveCount(3);
  await findings.first().scrollIntoViewIfNeeded();
  for (const id of ["loss", "missions", "hibberd"]) {
    const f = page.locator(`#finding-${id}`);
    await f.scrollIntoViewIfNeeded();
    await expect(f.locator(".finding-plot svg")).toBeVisible();
    await expect(f.locator("a.finding-link")).toHaveCount(1);
  }
  // The loss finding marks the three engines of the hero, with the 1 % Π from curve.json.
  const loss = page.locator("#finding-loss");
  await expect(loss.locator(".finding-plot .hit[tabindex]")).toHaveCount(4);                // three engines and the 1 % point
  await loss.locator(".finding-plot .hit[tabindex]").first().focus();
  await expect(loss.locator(".tooltip")).toBeVisible();
  const missions = page.locator("#finding-missions .finding-plot");
  await expect(missions).toHaveAttribute("data-mission-points", String(data("missions.json").Pi.length));
  await expect(page.locator("#finding-hibberd .finding-legend")).toContainText("Reference stack of Hibberd et al.");
});

// Every finding's explorer fallback (the link while its article section is unpublished) opens on a valid case: the
// preset is recognised and the explorer shows no warning (impact, capture, or a burn starting outside the sphere of
// influence). Read from the page source, so the check holds whichever link a build renders (author, 2026-10-21).
const FALLBACKS = [...readFileSync(new URL("../index.html", import.meta.url), "utf8").matchAll(/<!--#finding-link:([\w-]+)\|([^>]*?)-->/g)]
  .map((m) => ({ section: m[1], query: m[2] }));

test("there is one explorer fallback per finding", () => {
  expect(FALLBACKS.map((f) => f.section)).toEqual(["universal-curve", "atlas", "case-study"]);
});

for (const { section, query } of FALLBACKS) {
  test(`the explorer fallback for ${section} (?${query}) loads with no warning`, async ({ page }) => {
    await page.goto(`explorer/?${query}`);
    await expect(page.locator("[aria-label^='Trajectory of the flyby']")).toBeAttached();
    await expect(page.locator("#ex-preset")).toHaveValue(new URLSearchParams(query).get("preset")!);
    await expect(page.locator(".warning")).toHaveCount(0);
  });
}

test("the check catches a bad fallback: earth.hall starts its burn outside Earth's sphere of influence", async ({ page }) => {
  await page.goto("explorer/?preset=earth.hall");
  await expect(page.locator(".warning-soi")).toBeVisible();
});

test("reproducibility and scope: labelled pairs from methods.json", async ({ page }) => {
  await open(page, 1440);
  const m = data("methods.json");
  const repro = page.locator(".landing-repro");
  await repro.scrollIntoViewIfNeeded();
  await expect(repro.locator("dl.facts")).toContainText(`${m.audit.identical.value} of ${m.audit.outputs.value} outputs reproduced identically`);
  await expect(repro.locator("dl.facts")).toContainText(`${m.tests_collected} in the suite`);
  await expect(repro.locator("dl.facts")).toContainText(m.scope.engines.map((e: { value: string }) => e.value).join(", "));
});

// The Copy button needs the clipboard API, which browsers give only to secure contexts: localhost is one (author,
// 2026-10-21). The build is served there by the route handler, with clipboard permissions granted.
test.describe("on a secure origin", () => {
  test.use({ siteOrigin: "http://localhost:4317", baseURL: "http://localhost:4317/", permissions: ["clipboard-read", "clipboard-write"] });

  test("the Copy button appears and copies the citation text", async ({ page }) => {
    await page.goto("");
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
    const button = page.locator(".copy-button");
    await expect(button).toBeVisible();
    const citation = (await page.locator(".citation-text").textContent())!.trim();
    expect(citation.length).toBeGreaterThan(20);
    await button.click();
    await expect(button).toHaveText("Copied");
    await expect(page.locator(".site-footer [aria-live]")).toHaveText("Citation copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(citation);
  });
});

test("the footer cites the project from CITATION.cff, with the licences", async ({ page }) => {
  await open(page, 1440);
  const c = data("site.json").citation;
  await expect(page.locator(".citation-text")).toHaveText(new RegExp(`^${c.authors[0].family}, ${c.authors[0].given[0]}\\. \\(${c.date_released.slice(0, 4)}\\)\\. ${c.title}`));
  await expect(page.locator(".site-footer")).toContainText(`${c.authors[0].given} ${c.authors[0].family}`);
  await expect(page.locator('.site-footer a[href$="/LICENSE"]')).toHaveCount(1);
  await expect(page.locator('.site-footer a[href$="/LICENSE-content.md"]')).toHaveCount(1);
});
