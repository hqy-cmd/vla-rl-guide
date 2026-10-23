import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Inspect the deployed offline build, using the same Chrome default as B3b.
const url = pathToFileURL(fileURLToPath(new URL('../../index.html', import.meta.url))).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const errors = [];
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForSelector('html[data-ready=true]');
      assert.equal(await page.locator('.progress-number').textContent(), '0/9');
      for (const level of [1, 2, 3, 4]) {
        await page.locator(`.course-card[data-level="${level}"]`).click();
        await page.waitForFunction(level => document.querySelector('.stage-surface')?.dataset.level === String(level), level);
        const header = await page.locator('.progress-number').textContent();
        assert.match(header, /^\d\/9$/);
        const denominator = header.split('/')[1];
        for (const selector of ['.course-heading .numeric', '.stage-index']) {
          assert.equal(await page.locator(selector).textContent(), `${level}/${denominator}`);
        }
        for (const tab of ['overview', 'original', 'simplify', 'sources']) {
          const label = `${viewport.width}x${viewport.height} level ${level} ${tab}`;
          await page.locator(`#tab-${tab}`).click();
          assert.equal(await page.locator(`#tab-${tab}`).getAttribute('aria-selected'), 'true');
          const size = await page.locator('.tab-content').evaluate(panel => ({
            height: panel.clientHeight,
            scrollHeight: panel.scrollHeight,
            width: panel.clientWidth,
            scrollWidth: panel.scrollWidth,
            fonts: [...panel.querySelectorAll('h2, p, li')].map(node => parseFloat(getComputedStyle(node).fontSize)),
          }));
          assert(size.height > 0 && size.width > 0, `${label}: empty panel`);
          assert(size.scrollHeight <= size.height, `${label}: inner vertical scroll ${size.scrollHeight}px > ${size.height}px`);
          assert(size.scrollWidth <= size.width, `${label}: inner horizontal scroll`);
          assert(size.fonts.length > 0 && size.fonts.every(font => font >= 13), `${label}: body text below 13px`);
          console.log(`${label}: ${size.scrollHeight}/${size.height}px, passed`);
        }
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log('All 32 tab checks and progress counter checks passed.');
} finally {
  await browser.close();
}
