// The landing page (Phase 7; Phase 9 pass 3, docs/revamp_plan.md §2.5), against the test build: no console errors and
// no sideways scrolling at four widths; the hero's sequence (once per browser session, skipped under reduced motion),
// scrubbing, and the SEP caveat; the findings rows (a disclosure list: each opens in place to its live figure); the
// docked dive and the rows that steer it (from 1100 × 700; row 02 has no state); the scope facts, the key results and
// the footer's citation. The production build's checks (the Research link, links under the base path, above the fold)
// are in prod.spec.ts and fold.spec.ts; the preloader's in preloader.spec.ts.
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
    for (const head of await page.locator(".row-head").all()) await head.click();     // each row's figure mounts when it opens
    await expect(page.locator(".finding svg[role=img]")).toHaveCount(3);
    await expect(page.locator(".scope-facts dt")).toHaveCount(7);
    await expect(page.locator(".key-results li")).toHaveCount(4);
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

test("the ways on resolve: Read the research (the intro) and Open the explorer (the closing section)", async ({ page }) => {
  await open(page, 1440);
  await expect(page.locator(".intro-cta a")).toHaveText("Read the research");          // the test build shows the article
  await expect(page.locator(".closing-cta")).toHaveText("Open the explorer");
  for (const href of await page.locator(".intro-cta a, .closing-cta").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href)))
    expect((await page.goto(href))!.status(), href).toBe(200);
});

test("the findings rows: a disclosure list, one open at a time, each with its live figure and one link", async ({ page }) => {
  await open(page, 1440);
  const heads = page.locator(".row-head");
  await expect(heads).toHaveText([/Loss against Π/, /Where real missions sit/, /The Hibberd et al\. check/]);
  await expect(page.locator(".row-h")).toHaveCount(3);                                  // each button inside a heading
  for (const [i, id] of ["loss", "missions", "hibberd"].entries()) {
    const head = heads.nth(i), body = page.locator(`#row-${id}`);
    await expect(head).toHaveAttribute("aria-controls", `row-${id}`);
    await expect(body).toBeHidden();
    await head.focus();
    await page.keyboard.press("Enter");                                                 // the keyboard opens it
    await expect(head).toHaveAttribute("aria-expanded", "true");
    await expect(body).toBeVisible();
    await expect(page.locator('.row-head[aria-expanded="true"]')).toHaveCount(1);       // the others closed
    const f = page.locator(`#finding-${id}`);
    await expect(f.locator(".finding-plot svg")).toBeVisible();
    await expect(f.locator("a.finding-link")).toHaveCount(1);
  }
  await heads.nth(2).click();                                                           // and closes again
  await expect(page.locator("#row-hibberd")).toBeHidden();
  await heads.nth(0).click();
  // The loss finding marks the three engines of the hero, with the 1 % Π from curve.json.
  const loss = page.locator("#finding-loss");
  await expect(loss.locator(".finding-plot .hit[tabindex]")).toHaveCount(4);                // three engines and the 1 % point
  await loss.locator(".finding-plot .hit[tabindex]").first().focus();
  await expect(loss.locator(".tooltip")).toBeVisible();
  const missions = page.locator("#finding-missions .finding-plot");
  await expect(missions).toHaveAttribute("data-mission-points", String(data("missions.json").Pi.length));
  await expect(page.locator("#finding-hibberd .finding-legend")).toContainText("Reference stack of Hibberd et al.");
});

test("from 1100 × 700 the dive docks beside the rows, which steer it; row 02 has no state", async ({ page }) => {
  await open(page, 1440, false);
  const hero = page.locator("#landing-hero"), steer = () => hero.getAttribute("data-steer");
  await expect(page.locator("#dive-dock #landing-hero")).toHaveCount(1);
  await page.locator("#findings-title").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  await expect(page.locator("html")).toHaveClass(/dive-docked/);
  const heads = page.locator(".row-head");
  await heads.nth(0).hover();
  await expect.poll(steer).toBe("012b");                                                // every burn, the clock at the end
  await expect(page.locator("#rows li").nth(0)).toHaveClass(/is-active/);
  await heads.nth(1).hover();
  await expect.poll(steer).toBeNull();                                                  // row 02: as if pointing at nothing
  await heads.nth(2).hover();
  await expect.poll(steer).toBe("0");                                                   // the solid stack alone
  await expect(page.locator(".lh-key li").nth(1)).toHaveClass(/dim/);
  await page.mouse.move(5, 5);
  await expect.poll(steer).toBeNull();                                                  // the reader's own clock again
  await heads.nth(2).click();                                                           // an open row holds its state
  await page.mouse.move(5, 5);
  await expect.poll(steer).toBe("0");
  await heads.nth(1).hover();                                                           // row 02 leaves it as it is
  await expect.poll(steer).toBe("0");
  // Focus steers as pointing does, and the row says what the dive shows (the pointer moved off the rows first: pointing
  // takes priority over focus).
  await heads.nth(2).click();
  await page.mouse.move(5, 5);
  await heads.nth(0).focus();
  await expect.poll(steer).toBe("012b");
  await expect(heads.nth(0)).toHaveAttribute("aria-describedby", "row-loss-steer");
  await expect(heads.nth(1)).not.toHaveAttribute("aria-describedby", /.+/);
});

test("below 1100 px there is no dock: the dive stays in the band and the rows do not steer it", async ({ page }) => {
  await open(page, 768);
  await expect(page.locator("#dive-home #landing-hero")).toHaveCount(1);
  await page.locator(".row-head").nth(0).hover();
  expect(await page.locator("#landing-hero").getAttribute("data-steer")).toBeNull();
  await expect(page.locator(".row-head").nth(0)).not.toHaveAttribute("aria-describedby", /.+/);
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
  const facts = page.locator(".scope-facts");
  await facts.scrollIntoViewIfNeeded();
  await expect(facts).toContainText(`${m.audit.identical.value} of ${m.audit.outputs.value} outputs reproduced identically`);
  await expect(facts).toContainText(`${m.tests_collected} in the suite`);
  await expect(facts).toContainText(m.scope.engines.map((e: { value: string }) => e.value).join(", "));
});

test("key results: four numbers from the site data, each with a link to its source file", async ({ page }) => {
  await open(page, 1440);
  const m = data("methods.json"), curve = data("curve.json");
  const one = curve.thresholds.find((t: { level: string }) => t.level === "1%").Pi;
  const items = page.locator(".key-results li");
  await items.first().scrollIntoViewIfNeeded();
  await expect(items.locator(".num")).toHaveText([
    Number(m.scope.sweep_rows.value).toLocaleString("en-GB"), `${m.audit.identical.value} / ${m.audit.outputs.value}`,
    `Π = ${one.value.toPrecision(3)}`, m.rule_max_ratio_Pi_le_1.value.toPrecision(4)]);
  const srcs = [m.scope.sweep_rows.src, m.audit.identical.src, one.src, m.rule_max_ratio_Pi_le_1.src].map((s: string) => s.split("#")[0]);
  for (const [i, src] of srcs.entries())
    await expect(items.nth(i).locator(".src a")).toHaveAttribute("href", new RegExp(`/blob/[^/]+/${src.replace(/[.]/g, "\\.")}$`));
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
