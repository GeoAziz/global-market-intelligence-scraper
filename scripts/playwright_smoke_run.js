const fs = require('fs');
const path = require('path');
const { launchChromium } = require('../src/utils/playwrightHelper');
const log = require('../utils/logger');
const { parseRenderedPage } = require('../src/scrapers/genericScraper');
const { parseCointelegraph } = require('../src/scrapers/cointelegraphScraper');
const { parseCoindesk } = require('../src/scrapers/coindeskScraper');
const { parseYahooFinance } = require('../src/scrapers/yahooFinanceScraper');
const { localSummarize } = require('../src/summarizers/extractiveSummarizer');

const DEFAULT_URLS = [
  'https://cointelegraph.com',
  'https://www.coindesk.com',
  'https://finance.yahoo.com',
];

async function renderAndSave(page, url, outDir) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const html = await page.content();
  const file = path.join(outDir, `${(new URL(url)).hostname.replace(/[^a-z0-9.-]/gi, '_')}_${Date.now()}.html`);
  fs.writeFileSync(file, html);
  return file;
}

async function run() {
  const outDir = path.join(process.cwd(), 'exports', 'playwright-debug');
  fs.mkdirSync(outDir, { recursive: true });
  const urls = (process.env.PLAYWRIGHT_SMOKE_URLS || DEFAULT_URLS.join(',')).split(',').map(s => s.trim()).filter(Boolean);

  const browser = await launchChromium({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  for (const url of urls) {
    try {
      log.info('Rendering', { url });
      const file = await renderAndSave(page, url, outDir);
      const html = fs.readFileSync(file, 'utf8');
      let parsed = [];
      if (url.includes('cointelegraph')) parsed = parseCointelegraph(html, url);
      else if (url.includes('coindesk')) parsed = parseCoindesk(html, url);
      else if (url.includes('yahoo')) parsed = parseYahooFinance(html, url);
      else parsed = parseRenderedPage(html, url);

      for (const p of parsed) {
        const summary = localSummarize(p.text || p.title || '');
        results.push(Object.assign({}, p, { summary }));
      }
    } catch (e) {
      log.error('Playwright smoke step failed for url', { url, err: e && e.message });
    }
  }

  const outFile = path.join(process.cwd(), 'exports', `playwright_smoke_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log('Playwright smoke-run wrote', outFile, 'items:', results.length);
  await browser.close();
  process.exit(0);
}

run().catch(e => {
  console.error('Playwright smoke-run failed', e && e.stack);
  process.exit(2);
});
