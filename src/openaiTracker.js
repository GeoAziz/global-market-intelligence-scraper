const { openStore } = require('./cache') || require('./cache');
const log = require('../utils/logger');

const USAGE_KEY = process.env.OPENAI_USAGE_KV_KEY || 'openai-usage-v1';
const LOCK_KEY = process.env.OPENAI_USAGE_LOCK_KEY || 'openai-usage-lock';

async function getUsage() {
    try {
        const store = await openStore();
        const val = await store.getValue(USAGE_KEY);
        if (!val) return { tokensUsed: 0, requestsMade: 0, usdSpent: 0 };
        return val;
    } catch (e) {
        log.warn('openaiTracker.getUsage error', { err: e && e.message });
        return { tokensUsed: 0, requestsMade: 0, usdSpent: 0 };
    }
}

async function incrementUsage(delta) {
    try {
        const store = await openStore();
        const cur = (await getUsage()) || { tokensUsed: 0, requestsMade: 0, usdSpent: 0 };
        const updated = {
            tokensUsed: (cur.tokensUsed || 0) + (delta.tokens || 0),
            requestsMade: (cur.requestsMade || 0) + (delta.requests || 0),
            usdSpent: (cur.usdSpent || 0) + (delta.usd || 0),
            updatedAt: new Date().toISOString(),
        };
        await store.setValue(USAGE_KEY, updated);
        return updated;
    } catch (e) {
        log.warn('openaiTracker.incrementUsage error', { err: e && e.message });
        return null;
    }
}

/**
 * Try to reserve usage atomically-ish with retries. Because KeyValueStore
 * doesn't provide atomic compare-and-set, we implement a best-effort retry
 * loop: read current, check caps, write updated value. This reduces race
 * windows but is not perfectly atomic under heavy concurrent callers.
 *
 * Returns true if reservation succeeded, false if it would exceed caps.
 */
async function reserveUsage(delta, caps = {}) {
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const cur = await getUsage();
            const tokens = (cur.tokensUsed || 0) + (delta.tokens || 0);
            const requests = (cur.requestsMade || 0) + (delta.requests || 0);
            const usd = (cur.usdSpent || 0) + (delta.usd || 0);

            if (caps.maxTokensPerRun && tokens > caps.maxTokensPerRun) return false;
            if (caps.maxRequestsPerRun && requests > caps.maxRequestsPerRun) return false;
            if (caps.maxUsdPerRun && usd > caps.maxUsdPerRun) return false;

            const updated = { tokensUsed: tokens, requestsMade: requests, usdSpent: usd, updatedAt: new Date().toISOString() };
            const store = await openStore();
            await store.setValue(USAGE_KEY, updated);
            return true;
        } catch (e) {
            // small backoff
            await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
            continue;
        }
    }
    return false;
}

module.exports = { getUsage, incrementUsage };
