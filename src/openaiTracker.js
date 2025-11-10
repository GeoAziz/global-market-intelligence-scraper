const { openStore } = require('./cache') || require('./cache');
const log = require('../utils/logger');

const USAGE_KEY = process.env.OPENAI_USAGE_KV_KEY || 'openai-usage-v1';

// If REDIS_URL is provided, we'll attempt to use Redis for atomic reservations.
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI;
let redisClient = null;
if (REDIS_URL) {
    try {
        // require lazily so local dev without the package still works
        const IORedis = require('ioredis');
        redisClient = new IORedis(REDIS_URL);
    } catch (e) {
        log.warn('ioredis not available or failed to connect; falling back to KeyValueStore', { err: e && e.message });
        redisClient = null;
    }
}

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
        if (redisClient) {
            // Use HINCRBY style atomic ops by storing numeric fields in a Redis hash
            const key = USAGE_KEY;
            const multi = redisClient.multi();
            if (delta.tokens) multi.hincrby(key, 'tokensUsed', delta.tokens);
            if (delta.requests) multi.hincrby(key, 'requestsMade', delta.requests);
            if (delta.usd) multi.hincrbyfloat ? multi.hincrbyfloat(key, 'usdSpent', delta.usd) : multi.hincrby(key, 'usdSpent', Math.round((delta.usd || 0) * 100));
            multi.hset(key, 'updatedAt', new Date().toISOString());
            const res = await multi.exec();
            return await getUsage();
        } else {
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
        }
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
    // If Redis is available, perform an atomic check-and-set via Lua script.
    if (redisClient) {
        const key = USAGE_KEY;
        // Lua script: read hash fields, compute new totals, compare to caps, and update if ok
        const lua = `
        local key = KEYS[1]
        local dtokens = tonumber(ARGV[1])
        local drequests = tonumber(ARGV[2])
        local dusd = tonumber(ARGV[3])
        local maxTokens = tonumber(ARGV[4])
        local maxRequests = tonumber(ARGV[5])
        local maxUsd = tonumber(ARGV[6])
        local curTokens = tonumber(redis.call('hget', key, 'tokensUsed') or '0')
        local curRequests = tonumber(redis.call('hget', key, 'requestsMade') or '0')
        local curUsd = tonumber(redis.call('hget', key, 'usdSpent') or '0')
        local newTokens = curTokens + dtokens
        local newRequests = curRequests + drequests
        local newUsd = curUsd + dusd
        if maxTokens > 0 and newTokens > maxTokens then return 0 end
        if maxRequests > 0 and newRequests > maxRequests then return 0 end
        if maxUsd > 0 and newUsd > maxUsd then return 0 end
        redis.call('hincrby', key, 'tokensUsed', dtokens)
        redis.call('hincrby', key, 'requestsMade', drequests)
        -- store usd as integer cents to avoid float issues
        redis.call('hincrby', key, 'usdSpent', dusd)
        redis.call('hset', key, 'updatedAt', ARGV[7])
        return 1
        `;
        try {
            const now = new Date().toISOString();
            const res = await redisClient.eval(lua, 1, key, delta.tokens || 0, delta.requests || 0, delta.usd || 0, caps.maxTokensPerRun || 0, caps.maxRequestsPerRun || 0, caps.maxUsdPerRun || 0, now);
            return res === 1;
        } catch (e) {
            log.warn('Redis reserveUsage failed, falling back to KeyValueStore method', { err: e && e.message });
        }
    }

    // Fallback to best-effort compare-and-set using KeyValueStore (not atomic)
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

module.exports = { getUsage, incrementUsage, reserveUsage };
