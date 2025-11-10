const Apify = require('apify');
// Apify package layout varies between versions/environments. Use Apify.CheerioCrawler if present,
// otherwise fall back to a minimal local Cheerio-based crawler implementation.
let CheerioCrawler = Apify.CheerioCrawler;
if (!CheerioCrawler) {
    try {
        CheerioCrawler = require('./cheerioCrawlerFallback');
    } catch (err) {
        // If fallback cannot be loaded, rethrow so user can fix environment
        throw err;
    }
}
const { runScraper } = require('./scraper');
const { cleanArticles } = require('./cleaner');
const { summarizeBatch } = require('./summarizer');
const { getCachedSummary, saveCachedSummary } = require('./cache');
const { saveToDataset, exportToFile } = require('./output');
const log = require('../utils/logger');

// Use Apify Actor lifecycle helpers when available
;(async () => {
    try {
        if (Apify.Actor && typeof Apify.Actor.init === 'function') await Apify.Actor.init();

        let input = null;
        if (Apify.Actor && typeof Apify.Actor.getInputOrThrow === 'function') {
            try {
                input = await Apify.Actor.getInputOrThrow();
            } catch (e) {
                // If no input provided, fall back to sensible defaults
                input = { assets: ['forex', 'crypto', 'stocks'], frequency: 'daily' };
            }
        } else if (Apify.Actor && typeof Apify.Actor.getInput === 'function') {
            input = await Apify.Actor.getInput();
        } else if (process.env.GMIS_INPUT) {
            try { input = JSON.parse(process.env.GMIS_INPUT); } catch (e) { input = null; }
        }
        input = input || { assets: ['forex', 'crypto', 'stocks'], frequency: 'daily' };

        // Basic validation
        if (!Array.isArray(input.assets) || input.assets.length === 0) {
            throw new Error('Invalid input: "assets" must be a non-empty array');
        }

        const assets = input.assets || ['forex', 'crypto', 'stocks'];
        const frequency = input.frequency || 'daily';

        log.info('Starting GMIS run', { assets, frequency });

        // Step 1: Scrape data
        const raw = await runScraper({ assets, maxConcurrency: 5, maxRequestsPerCrawl: input.maxRequestsPerCrawl || 50 });

        // Step 2: Clean
        const cleaned = cleanArticles(raw);
        log.info('Cleaned articles', { count: cleaned.length });

        if (cleaned.length === 0) {
            log.info('No articles found, exiting');
            if (Apify.Actor && typeof Apify.Actor.exit === 'function') await Apify.Actor.exit();
            return;
        }

        // Step 3: Summarize in batches (batch size 5)
        const batchSize = 5;
        const summarized = [];
        for (let i = 0; i < cleaned.length; i += batchSize) {
            const chunk = cleaned.slice(i, i + batchSize);
            const out = await summarizeBatch(chunk, { batchSize, mode: process.env.MODE || 'free', hfToken: process.env.HF_TOKEN });
            summarized.push(...out);
        }
        log.info('Summarization complete', { count: summarized.length });

        // Step 4: Save results
        for (const r of summarized) {
            const record = {
                asset: r.asset,
                title: r.title,
                date: r.date,
                link: r.link,
                summary: r.summary,
                scrapedAt: r.scrapedAt,
                processedAt: new Date().toISOString(),
            };
            await saveToDataset(record);
        }

        // Optional export
        if (process.env.EXPORT === 'true') {
            await exportToFile(summarized, { dir: 'exports', format: 'json' });
        }

        log.info('Run finished successfully');
        if (Apify.Actor && typeof Apify.Actor.exit === 'function') await Apify.Actor.exit();
    } catch (err) {
        log.error('Fatal error in main', err);
        if (Apify.Actor && typeof Apify.Actor.fail === 'function') await Apify.Actor.fail(err);
        process.exitCode = 1;
    }
})();
