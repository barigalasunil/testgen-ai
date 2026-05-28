const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = [];
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => out.push({ type: 'console', text: msg.text(), location: msg.location() }));
  page.on('pageerror', err => out.push({ type: 'pageerror', text: err.message }));
  page.on('requestfailed', req => out.push({ type: 'requestfailed', url: req.url(), failure: req.failure() }));
  page.on('response', async res => {
    out.push({ type: 'response', url: res.url(), status: res.status() });
  });

  try {
    const url = process.env.TARGET_URL || 'http://localhost:3000';
    out.push({ type: 'start', url });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800); // allow client JS to run
    const title = await page.title();
    out.push({ type: 'title', title });
    await page.screenshot({ path: '/workspaces/testgen-ai/automation/reports/headless-screenshot.png', fullPage: true });

    const html = await page.content();
    fs.writeFileSync('/workspaces/testgen-ai/automation/reports/headless-page.html', html);

    out.push({ type: 'screenshot', path: '/automation/reports/headless-screenshot.png' });
  } catch (err) {
    out.push({ type: 'error', message: err.message, stack: err.stack });
  } finally {
    await browser.close();
    fs.writeFileSync('/workspaces/testgen-ai/automation/reports/headless-log.json', JSON.stringify(out, null, 2));
    console.log('Headless check completed. Logs written to automation/reports/headless-log.json');
  }
})();
