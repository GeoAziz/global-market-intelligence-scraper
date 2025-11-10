const Apify = require('apify');
const { createHash } = require('crypto');
const log = require('../utils/logger');

// Use Apify Actor KeyValueStore
async function openStore() {
    // Use Actor.openKeyValueStore when running as Actor
    if (typeof Apify.openKeyValueStore === 'function') return Apify.openKeyValueStore();
    if (Apify.Actor && typeof Apify.Actor.openKeyValueStore === 'function') return Apify.Actor.openKeyValueStore();
    // Last resort: try openKeyValueStore on Actor instance
    if (Apify.Actor && typeof Apify.Actor === 'object' && typeof Apify.Actor.openKeyValueStore === 'function') return Apify.Actor.openKeyValueStore();
    throw new Error('No KeyValueStore open function available in Apify SDK');
}

function makeKey(str) {
    return createHash('sha256').update(str).digest('hex');
}

async function getCachedSummary(key) {
    try {
        const store = await openStore();
        const val = await store.getValue(key);
        if (!val) return null;
        // Expect stored object { summary, model, modelVersion, cachedAt, ttlSeconds, sourceHash }
        if (typeof val === 'string') return val; // backward compatibility
        const now = Date.now();
        if (val.cachedAt && val.ttlSeconds) {
            const age = (now - new Date(val.cachedAt).getTime()) / 1000;
            if (age > val.ttlSeconds) {
                // expired
                return null;
            }
        }
        return val.summary || null;
    } catch (err) {
        log.warn('Cache read error', { err: err.message });
        return null;
    }
}

async function saveCachedSummary(key, summary) {
    try {
        const store = await openStore();
        const payload = {
            summary: summary,
            model: process.env.SUMMARY_MODEL || 'facebook/bart-large-cnn',
            modelVersion: process.env.SUMMARY_MODEL_VERSION || 'inference-api',
            cachedAt: new Date().toISOString(),
            ttlSeconds: Number(process.env.CACHE_TTL_SECONDS || 86400),
        };
        await store.setValue(key, payload);
        return true;
    } catch (err) {
        log.warn('Cache write error', { err: err.message });
        return false;
    }
}

module.exports = { getCachedSummary, saveCachedSummary, makeKey };
