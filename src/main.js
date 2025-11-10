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

    // Configuration from environment
    const maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || input.maxConcurrency || '5', 10);
    const batchSize = parseInt(process.env.BATCH_SIZE || input.batchSize || '5', 10);
    const maxRequestsPerCrawl = parseInt(process.env.MAX_REQUESTS_PER_CRAWL || input.maxRequestsPerCrawl || '50', 10);

    // Step 1: Scrape data
    const raw = await runScraper({ assets, maxConcurrency, maxRequestsPerCrawl });

        // Step 2: Clean
        const cleaned = cleanArticles(raw);
        log.info('Cleaned articles', { count: cleaned.length });

        if (cleaned.length === 0) {
            log.info('No articles found, exiting');
            if (Apify.Actor && typeof Apify.Actor.exit === 'function') await Apify.Actor.exit();
            return;
        }

        // Step 3: Summarize in batches
        // Decide summarization mode; allow whole-run early-cutoff based on estimated cost
        let mode = process.env.MODE || 'free';
        // If OPENAI mode requested and USD cap is set, estimate total run cost and switch to local if it exceeds cap
        if (mode === 'openai' && process.env.OPENAI_MAX_USD_PER_RUN) {
            try {
                const { estimateTokens } = require('./summarizers/openAISummarizer');
                const usdPer1k = Number(process.env.OPENAI_USD_PER_1K_TOKENS || process.env.OPENAI_USD_PER_1K || '0.02');
                let totalTokens = 0;
                for (const it of cleaned) {
                    const text = it.text || it.summary || it.title || '';
                    totalTokens += (estimateTokens(text, process.env.OPENAI_MODEL) || 0) + (parseInt(process.env.OPENAI_DEFAULT_MAX_TOKENS || '200', 10));
                }
                const estUsd = (totalTokens / 1000.0) * usdPer1k;
                if (estUsd > Number(process.env.OPENAI_MAX_USD_PER_RUN)) {
                    log.warn('Estimated OpenAI run cost exceeds OPENAI_MAX_USD_PER_RUN; forcing local summarizer for safety', { estUsd, cap: process.env.OPENAI_MAX_USD_PER_RUN });
                    mode = 'local';
                }
            } catch (e) {
                log.warn('Failed to estimate OpenAI run cost; proceeding with configured mode', { err: e && e.message });
            }
        }
        const summarized = [];
        for (let i = 0; i < cleaned.length; i += batchSize) {
            const chunk = cleaned.slice(i, i + batchSize);
            const out = await summarizeBatch(chunk, { batchSize, mode, hfToken: process.env.HF_TOKEN });
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
