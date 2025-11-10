const { callHFSummary } = require('./huggingfaceSummarizer');
const { callOpenAISummary } = require('./openAISummarizer');
const { localSummarize } = require('./extractiveSummarizer');
const pRetry = require('p-retry');
const CircuitBreaker = require('opossum');
const { sha256 } = require('../../utils/hash');
const { getCachedSummary, saveCachedSummary } = require('../cache');
const metrics = require('../metrics');
const log = require('../../utils/logger');

// Circuit breaker for HF calls
const hfBreaker = new CircuitBreaker((text, token) => callHFSummary(text, token), {
    timeout: 20000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
});

hfBreaker.on('open', () => log.warn('HF circuit breaker opened'));
hfBreaker.on('halfOpen', () => log.info('HF circuit breaker half-open'));
hfBreaker.on('close', () => log.info('HF circuit breaker closed'));

async function summarizeBatch(items, opts = {}) {
    const hfToken = process.env.HF_TOKEN || opts.hfToken;
    const mode = (process.env.MODE || opts.mode || 'free');
    const batchSize = opts.batchSize || 5;
    const results = [];

    const toProcess = [];
    for (const it of items) {
        const key = sha256(`${it.asset}||${it.title}`);
        const cached = await getCachedSummary(key);
        if (cached) {
            try { metrics.cacheHits.inc(); } catch (e) {}
            results.push(Object.assign({}, it, { summary: cached }));
        } else {
            toProcess.push({ item: it, key });
        }
    }

    for (let i = 0; i < toProcess.length; i += batchSize) {
        const chunk = toProcess.slice(i, i + batchSize);
        if (mode === 'openai' && process.env.OPENAI_KEY) {
            // Prefer OpenAI when explicitly selected
            log.info('Using OpenAI summarizer for chunk', { size: chunk.length });
            const calls = chunk.map(({ item }) => {
                const textToSummarize = item.text || item.summary || item.title || '';
                return pRetry(() => callOpenAISummary(textToSummarize, process.env.OPENAI_KEY), {
                    retries: 1,
                    onFailedAttempt: err => log.warn('OpenAI attempt failed', { attempt: err.attemptNumber, retriesLeft: err.retriesLeft, message: err.message })
                }).then(s => ({ ok: true, s })).catch(e => ({ ok: false, e }));
            });
            const settled = await Promise.all(calls);
            for (let j = 0; j < chunk.length; j++) {
                const { item, key } = chunk[j];
                const r = settled[j];
                if (r.ok) {
                    const summary = r.s;
                    try { metrics.summariesGenerated.inc(); } catch (e) {}
                    await saveCachedSummary(key, summary);
                        results.push(Object.assign({}, item, { summary, summaryModel: 'openai', summaryModelVersion: process.env.OPENAI_MODEL || 'gpt-3.5-turbo' }));
                } else {
                    log.warn('OpenAI call failed for item, falling back to HF/local', { err: r.e && r.e.message });
                    // fallback to HF or extractive
                    try {
                        if (hfToken) {
                            const s = await callHFSummary(item.text || item.title, hfToken);
                            await saveCachedSummary(key, s);
                            results.push(Object.assign({}, item, { summary: s }));
                        } else {
                            const s = localSummarize(item.text || item.title);
                            await saveCachedSummary(key, s);
                            results.push(Object.assign({}, item, { summary: s }));
                        }
                    } catch (fe) {
                        const s = localSummarize(item.text || item.title);
                        await saveCachedSummary(key, s);
                        results.push(Object.assign({}, item, { summary: s, summaryModel: 'extractive-fallback' }));
                    }
                }
            }
        } else if (mode !== 'local' && hfToken) {
            log.info('Sending batch to HF API', { size: chunk.length });
            const calls = chunk.map(({ item }) => {
                const textToSummarize = item.text || item.summary || item.title || '';
                return pRetry(() => hfBreaker.fire(textToSummarize, hfToken), {
                    retries: 2,
                    onFailedAttempt: err => {
                        log.warn('HF attempt failed', { attempt: err.attemptNumber, retriesLeft: err.retriesLeft, message: err.message });
                    }
                }).then(s => ({ ok: true, s })).catch(e => ({ ok: false, e }));
            });
            const settled = await Promise.all(calls);
            for (let j = 0; j < chunk.length; j++) {
                const { item, key } = chunk[j];
                const r = settled[j];
                if (r.ok) {
                    const summary = r.s;
                    try { metrics.hfCalls.inc(); } catch (e) {}
                    await saveCachedSummary(key, summary);
                    try { metrics.summariesGenerated.inc(); } catch (e) {}
                        results.push(Object.assign({}, item, { summary, summaryModel: process.env.SUMMARY_MODEL || 'facebook/bart-large-cnn', summaryModelVersion: 'inference-api' }));
                } else {
                    try { metrics.hfFailures.inc(); } catch (e) {}
                    log.warn('HF call failed for item, using extractive fallback', { err: r.e && r.e.message });
                    const summary = localSummarize(item.text || item.title);
                    await saveCachedSummary(key, summary);
                    results.push(Object.assign({}, item, { summary }));
                }
            }
        } else {
            // local mode or no hf token
            for (const { item, key } of chunk) {
                const summary = localSummarize(item.text || item.title);
                await saveCachedSummary(key, summary);
                results.push(Object.assign({}, item, { summary }));
            }
        }
    }
    return results;
}

module.exports = { summarizeBatch };
