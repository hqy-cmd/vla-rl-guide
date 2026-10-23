import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const shots = path.resolve(root, "../vla-rl-guide-shots");
await mkdir(shots, { recursive: true });
const site = JSON.parse(
  await readFile(path.join(root, "site-src/content/site.json"), "utf8"),
);
const ready = site.levels.filter((level) => level.status === "ready");
const errors = [];
const external = [];
const report = [];
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  // Use the system Chrome hardware path; software GPU readback emits driver diagnostics.
  args: [],
});
function track(page, label) {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()))
      external.push(`${label}: ${request.url()}`);
  });
  page.on("requestfailed", (request) =>
    errors.push(`${label}: ${request.url()} ${request.failure()?.errorText}`),
  );
}
async function open(page, relative = "index.html") {
  await page.goto(pathToFileURL(path.join(root, relative)).href);
}
async function readyApp(page) {
  await page.waitForSelector("html[data-ready=true]");
  await page.waitForFunction(
    () => document.querySelectorAll(".callout").length >= 4,
  );
}
async function assertGeometry(page, label, oneScreen = true) {
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector("#stage").getBoundingClientRect();
    const cards = [...document.querySelectorAll(".callout")].map((node) => {
      const r = node.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        height: r.height,
      };
    });
    return {
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      innerHeight,
      innerWidth,
      stage: {
        x: stage.x,
        y: stage.y,
        right: stage.right,
        bottom: stage.bottom,
      },
      cards,
      controls: document
        .querySelector(".controls-card")
        .getBoundingClientRect()
        .toJSON(),
      strip: document
        .querySelector(".coursebar")
        .getBoundingClientRect()
        .toJSON(),
    };
  });
  if (oneScreen) {
    assert(
      geometry.height <= geometry.innerHeight,
      `${label}: page overflow ${JSON.stringify(geometry)}`,
    );
    assert(
      geometry.controls.bottom <= geometry.strip.y,
      `${label}: controls overlap course strip`,
    );
  }
  assert(
    geometry.width <= geometry.innerWidth,
    `${label}: horizontal document overflow`,
  );
  for (const [i, card] of geometry.cards.entries()) {
    assert(
      card.x >= geometry.stage.x &&
        card.right <= geometry.stage.right &&
        card.y >= geometry.stage.y &&
        card.bottom <= geometry.stage.bottom,
      `${label}: callout outside stage`,
    );
    for (const other of geometry.cards.slice(i + 1)) {
      assert(
        card.right <= other.x ||
          other.right <= card.x ||
          card.bottom <= other.y ||
          other.bottom <= card.y,
        `${label}: overlapping callouts`,
      );
    }
  }
  report.push({
    label,
    scrollHeight: geometry.height,
    viewportHeight: geometry.innerHeight,
    callouts: geometry.cards.length,
  });
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const label = `${viewport.width}x${viewport.height}`;
    track(page, label);
    await open(page);
    await readyApp(page);
    await page.evaluate(() => localStorage.removeItem("vla-guide:done"));
    await page.reload();
    await readyApp(page);
    assert.equal(await page.locator(".progress-number").innerText(), "0/9");
    for (const level of ready) {
      await page.locator(`.course-card[data-level="${level.id}"]`).click();
      await page.waitForURL(`**#/${level.slug}`);
      await page.waitForFunction(
        (id) =>
          document.querySelector(".stage-surface")?.dataset.level ===
          String(id),
        level.id,
      );
      await page.waitForTimeout(80);
      assert.equal(
        await page.locator(".tab-content h2").innerText(),
        level.title,
      );
      await assertGeometry(page, `${label} level ${level.id}`);
      for (const name of ["原文", "简化说明", "出处", "概览"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        assert(await page.locator("[role=tabpanel]").innerText());
      }
      await page.screenshot({
        path: path.join(shots, `b1_${label}_level${level.id}.png`),
      });
    }
    // Controls use the bus and update visible current values.
    await page.locator('.course-card[data-level="3"]').click();
    await page.waitForFunction(
      () => document.querySelector(".stage-surface")?.dataset.level === "3",
    );
    const slider = page.locator("input[type=range]");
    await slider.fill("11");
    assert.equal(
      await page.locator(".control-heading output").innerText(),
      "11 步",
    );
    assert.equal(
      await page.locator(".stage-surface").getAttribute("data-last-control"),
      "delay",
    );
    await page.getByRole("button", { name: "RTC", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "RTC", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.getByRole("button", { name: "首页", exact: true }).click();
    await page.waitForURL("**#/see-act");
    await page.waitForFunction(
      () => document.querySelector(".stage-surface")?.dataset.level === "1",
    );
    await page.getByRole("button", { name: "运行", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".progress-number").textContent === "1/9");
    assert.equal(await page.locator(".progress-number").innerText(), "1/9");
    assert(
      await page
        .locator('.course-card[data-level="1"]')
        .evaluate((node) => node.classList.contains("done")),
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("vla-guide:done")),
      ),
      [1],
    );
    await page.getByRole("button", { name: "运行", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".progress-number").textContent === "1/9");
    assert.equal(await page.locator(".progress-number").innerText(), "1/9");
    await page.reload();
    await readyApp(page);
    await page.waitForFunction(() => document.querySelector(".progress-number").textContent === "1/9");
    assert.equal(await page.locator(".progress-number").innerText(), "1/9");
    await page.screenshot({
      path: path.join(shots, `b1_${label}_completed.png`),
    });
    await page.locator('.course-card[data-level="2"]').click();
    await page.waitForURL("**#/patches");
    await page.goBack();
    await page.waitForURL("**#/see-act");
    await page.goForward();
    await page.waitForURL("**#/patches");
    await page.getByRole("button", { name: "课程", exact: true }).click();
    await page.locator('.drawer-lesson[data-level="5"]').click({ force: true });
    assert(page.url().endsWith("#/patches"));
    assert.equal(await page.locator(".toast").innerText(), site.soonText);
    await page.screenshot({
      path: path.join(shots, `b1_${label}_courses.png`),
    });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "关于", exact: true }).click();
    for (const text of [
      site.about.text,
      ...site.about.papers,
      site.about.pageNote,
      site.about.credit,
      site.about.v3Text,
    ]) {
      assert((await page.locator(".drawer-body").innerText()).includes(text));
    }
    assert.equal(
      await page.locator(".legacy-link").getAttribute("href"),
      "v3/index.html",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "概览", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page
        .getByRole("tab", { name: "原文", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page.evaluate(() => {
      location.hash = "#/recap";
    });
    await page.waitForURL("**#/patches");
    await context.close();
  }
  // Narrow layouts and memory-only storage fallback.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      });
    });
    const page = await context.newPage();
    track(page, `narrow-${viewport.width}`);
    await open(page);
    await readyApp(page);
    for (const level of ready) {
      await page.evaluate((slug) => {
        location.hash = `#/${slug}`;
      }, level.slug);
      await page.waitForFunction(
        (id) =>
          document.querySelector(".stage-surface")?.dataset.level ===
          String(id),
        level.id,
      );
      await page.waitForTimeout(80);
      await assertGeometry(page, `${viewport.width} level ${level.id}`, false);
    }
    await page.evaluate(() => {
      location.hash = "#/see-act";
    });
    await page.getByRole("button", { name: "运行", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".progress-number").textContent === "1/9");
    assert.equal(await page.locator(".progress-number").innerText(), "1/9");
    await page.screenshot({
      path: path.join(shots, `b1_${viewport.width}_mobile.png`),
      fullPage: true,
    });
    await context.close();
  }
  const oldContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const old = await oldContext.newPage();
  track(old, "v3");
  for (const relative of [
    "v3/index.html",
    "v3/w1_patch_embedding.html",
    "v3/w4_flow_matching.html",
    "v3/w5_action_chunk_rtc.html",
    "v3/w6_value_advantage.html",
  ]) {
    await open(old, relative);
    await old.waitForFunction(() => window.__ready === true, null, {
      timeout: 20000,
    });
    await old.screenshot({
      path: path.join(shots, `b1_${path.basename(relative, ".html")}_v3.png`),
    });
    report.push({ label: relative, ready: true });
  }
  for (const relative of [
    "w1_patch_embedding.html",
    "w4_flow_matching.html",
    "w5_action_chunk_rtc.html",
    "w6_value_advantage.html",
  ]) {
    await old.goto(
      `${pathToFileURL(path.join(root, relative)).href}#acceptance-anchor`,
    );
    await old.waitForURL(`**/v3/${relative}#acceptance-anchor`);
    report.push({ label: `${relative} redirect`, hashPreserved: true });
  }
  await oldContext.close();
  const html = await readFile(path.join(root, "index.html"), "utf8");
  assert(!/type\s*=\s*["']module|modulepreload/i.test(html));
  assert.equal(
    (await readdir(path.join(root, "assets"))).filter((file) =>
      file.endsWith(".js"),
    ).length,
    1,
  );
  assert.deepEqual(external, [], "External network requests");
  assert.deepEqual(errors, [], "Browser console/page/resource errors");
  report.push({
    externalRequests: external.length,
    browserErrors: errors.length,
    singleClassicScript: true,
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(
    path.join(shots, "b1_acceptance.json"),
    JSON.stringify({ report, errors, external }, null, 2),
  );
  await browser.close();
}
