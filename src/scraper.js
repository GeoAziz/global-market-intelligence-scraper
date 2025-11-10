const cheerio = require('cheerio');
const Apify = require('apify');
const log = require('../utils/logger');
const { cleanText } = require('./cleaner');
const pMap = require('p-map');
const playwright = require('playwright');
const fs = require('fs');
const path = require('path');
const pRetry = require('p-retry');

/**
 * runScraper orchestrates a CheerioCrawler over provided assets.
 * Input: assets - array of strings (either URLs or tickers/assets)
 * Output: array of { asset, title, link, date, text }
 */
async function runScraper({ assets = [], maxConcurrency = 5, maxRequestsPerCrawl = 100 } = {}) {
    const results = [];

    // Prepare request queue
    const requestQueue = await (Apify.Actor && typeof Apify.Actor.openRequestQueue === 'function'
        ? Apify.Actor.openRequestQueue()
        : Apify.openRequestQueue ? Apify.openRequestQueue() : null);

    // Normalize assets into requests
    const requests = [];
    for (const a of assets) {
        if (!a) continue;
        if (typeof a === 'string' && /^https?:\/\//i.test(a)) {
            requests.push({ url: a, userData: { asset: a } });
        } else {
            // Treat as ticker/asset - search news (Google News as a lightweight source)
            const url = `https://news.google.com/search?q=${encodeURIComponent(a)}`;
            requests.push({ url, userData: { asset: a } });
        }
    }

    // Enqueue into requestQueue if exists
    if (requestQueue && typeof requestQueue.addRequest === 'function') {
        for (const r of requests) await requestQueue.addRequest(r);
    }

    // Build a flat list of URLs to process (use requestQueue if available)
    let toProcess = [];
    if (requestQueue && typeof requestQueue.getInfo === 'function') {
        // If using Apify request queue we can't easily enumerate here; fall back to requests
        toProcess = requests;
    } else {
        toProcess = requests;
    }

    // Use Playwright to render each page and then parse with Cheerio.
    // Try a normal Playwright launch first. If Playwright browser binaries
    // weren't installed (common when `npx playwright install` wasn't run),
    // fall back to using a system Chromium executable if available.
    let browser;
    const systemChromiumPaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
    ];

    const findSystemChromium = () => systemChromiumPaths.find(p => {
        try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch (e) { return false; }
    });

    try {
        browser = await playwright.chromium.launch({ headless: true });
    } catch (err) {
        // If Playwright couldn't find its bundled browser, try system Chromium.
        const sysChromium = findSystemChromium();
        if (sysChromium) {
            log.warn('Playwright browser not found in cache; falling back to system Chromium', { path: sysChromium, err: err && err.message });
            // Pass executablePath and some safe flags for containerized / no-sandbox environments.
            browser = await playwright.chromium.launch({
                headless: true,
                executablePath: sysChromium,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        } else {
            // Re-throw to let caller handle it (this will surface helpful error to the user).
            throw err;
        }
    }
    const metrics = require('./metrics');
    try {
        await pMap(toProcess, async (r) => {
            const url = r.url;
            const asset = (r.userData && r.userData.asset) || 'unknown';
            log.info('Rendering with Playwright', { url, asset });

            // Retry navigation a few times for transient network errors
            // Respect robots.txt and per-host rate limiting
            try {
                const { isAllowed } = require('./utils/robotsHelper');
                const allowed = await isAllowed(url);
                if (!allowed) {
                    log.info('Skipping URL due to robots.txt disallow', { url });
                    return null;
                }
            } catch (e) { /* ignore */ }
            try {
                const { waitForHost } = require('./utils/rateLimiter');
                const host = (new URL(url)).hostname;
                await waitForHost(host);
            } catch (e) { /* ignore */ }

            const html = await pRetry(async () => {
                const context = await browser.newContext();
                const page = await context.newPage();
                // set a reasonable timeout
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                const content = await page.content();
                await page.close();
                await context.close();
                return content;
            }, { retries: 2 });

            try {
                const startTs = Date.now();
                // Optional debug: write rendered HTML to /tmp for inspection
                if (process.env.DEBUG_HTML === 'true') {
                    try {
                        const host = (new URL(url)).hostname.replace(/[:\/\\]/g, '_');
                        const fname = `/tmp/gmis-debug-${host}-${Date.now()}.html`;
                        require('fs').writeFileSync(fname, html || '', 'utf8');
                        log.info('Wrote debug HTML', { file: fname });
                    } catch (e) { log.warn('Failed to write debug HTML', { err: e && e.message }); }
                }

                // Choose site-specific parser when available
                const host = (new URL(url)).hostname.replace(/^www\./, '').toLowerCase();
                let articles = null;
                try {
                    if (host.includes('cointelegraph')) {
                        const { parseCointelegraph } = require('./scrapers/cointelegraphScraper');
                        articles = parseCointelegraph(html, url);
                    } else if (host.includes('coindesk')) {
                        const { parseCoindesk } = require('./scrapers/coindeskScraper');
                        articles = parseCoindesk(html, url);
                    } else if (host.includes('finance.yahoo') || host.includes('yahoo')) {
                        const { parseYahooFinance } = require('./scrapers/yahooFinanceScraper');
                        articles = parseYahooFinance(html, url);
                    } else {
                        articles = parseRenderedPage(html, url);
                    }
                } catch (e) {
                    log.warn('Site-specific parser failed, falling back to generic', { host, err: e && e.message });
                    articles = parseRenderedPage(html, url);
                }
                for (const a of articles) {
                    const rec = Object.assign({ asset, scrapedAt: new Date().toISOString() }, a);
                    results.push(rec);
                    try { metrics.articlesProcessed.inc(); } catch (e) {}
                    if (typeof Apify.Actor.pushData === 'function') await Apify.Actor.pushData(Object.assign({ raw: true }, rec));
                    else if (typeof Apify.pushData === 'function') await Apify.pushData(Object.assign({ raw: true }, rec));
                }
                // record per-site success and latency
                try {
                    const { perSiteSuccess, requestLatency } = require('./metrics');
                    perSiteSuccess.inc({ site: host }, articles.length || 0);
                    requestLatency.observe((Date.now() - startTs) / 1000);
                } catch (e) {}
            } catch (err) {
                log.error('Error parsing rendered page', { url, err: err && err.message });
            }
        }, maxConcurrency);
    } finally {
        await browser.close();
    }

    log.info('Scraper finished', { count: results.length });
    return results;
}

module.exports = { runScraper };
