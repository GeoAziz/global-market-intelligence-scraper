const stringSimilarity = require('string-similarity');
const { cleanText } = require('./cleanText');

function stringSimilarityScore(a, b) {
    try { return stringSimilarity.compareTwoStrings(a, b); } catch (e) { return 0; }
}

/**
 * deduplicateArticles removes duplicates and normalizes fields
 * @param {Array} items
 */
function deduplicateArticles(items = []) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
        if (!it || !it.title) continue;
        const asset = (it.asset || '').toString().trim();
        const title = it.title.toString().trim();
        const key = `${asset.toLowerCase()}||${title.toLowerCase()}`;
        if (seen.has(key)) continue;

        const text = cleanText(it.text || '');
        // fuzzy deduplication
        let isDuplicate = false;
        for (const existing of out) {
            const scoreTitle = stringSimilarityScore(title, existing.title);
            const scoreText = text && existing.text ? stringSimilarityScore(text, existing.text) : 0;
            if (Math.max(scoreTitle, scoreText) >= 0.8) {
                isDuplicate = true;
                break;
            }
        }
        if (isDuplicate) continue;

        seen.add(key);
        const summary = it.summary || '';
        out.push({
            asset,
            title,
            link: it.link || '',
            date: it.date || new Date().toISOString(),
            text,
            summary: cleanText(summary),
            scrapedAt: it.scrapedAt || new Date().toISOString(),
        });
    }
    return out;
}

module.exports = { deduplicateArticles };
