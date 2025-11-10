const fetch = require('node-fetch');
const url = require('url');
const log = require('../../utils/logger') || require('../utils/logger');

const cache = new Map(); // host -> { fetchedAt, rules: { disallow: [] } }

async function fetchRobots(host) {
    try {
        const robotsUrl = `https://${host}/robots.txt`;
        const res = await fetch(robotsUrl, { timeout: 5000 });
        if (!res.ok) return { disallow: [] };
        const text = await res.text();
        const lines = text.split(/\r?\n/).map(l => l.trim());
        const disallow = [];
        let uaAll = false;
        for (const line of lines) {
            if (!line) continue;
            const parts = line.split(':');
            if (parts.length < 2) continue;
            const k = parts[0].trim().toLowerCase();
            const v = parts.slice(1).join(':').trim();
            if (k === 'user-agent') {
                uaAll = (v === '*' || v.toLowerCase().includes('*'));
            } else if (k === 'disallow' && uaAll) {
                disallow.push(v || '/');
            }
        }
        return { disallow };
    } catch (e) {
        log && log.warn && log.warn('robotsHelper.fetchRobots failed', { err: e && e.message });
        return { disallow: [] };
    }
}

async function isAllowed(targetUrl) {
    try {
        const h = url.parse(targetUrl).host;
        if (!h) return true;
        const cached = cache.get(h);
        if (cached && (Date.now() - cached.fetchedAt) < (24 * 60 * 60 * 1000)) {
            return checkPathAllowed(targetUrl, cached.rules.disallow);
        }
        const rules = await fetchRobots(h);
        cache.set(h, { fetchedAt: Date.now(), rules });
        return checkPathAllowed(targetUrl, rules.disallow);
    } catch (e) {
        return true;
    }
}

function checkPathAllowed(targetUrl, disallowList) {
    try {
        const p = url.parse(targetUrl).pathname || '/';
        for (const d of disallowList) {
            if (!d) continue;
            // simple prefix match
            if (p.startsWith(d)) return false;
        }
        return true;
    } catch (e) { return true; }
}

module.exports = { isAllowed };
