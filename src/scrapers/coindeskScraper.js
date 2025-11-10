const cheerio = require('cheerio');

/** site-specific parser for Coindesk pages */
function parseCoindesk(html, url) {
    const $ = cheerio.load(html || '');
    const articles = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const j = JSON.parse($(el).contents().text());
            if (j && (j['@type'] === 'NewsArticle' || j['@type'] === 'Article')) {
                const title = j.headline || j.name || $('title').text();
                const link = j.mainEntityOfPage || url;
                const date = j.datePublished || j.dateCreated || null;
                const text = j.articleBody || '';
                articles.push({ title, link, date, text });
            }
        } catch (e) {}
    });

    // Fallback: article tags and common Coindesk selectors
    $('article, .article-content, .entry-content, .text-content').each((i, el) => {
        const $el = $(el);
        let title = $el.find('h1, h2, .article__title').first().text().trim();
        if (!title) title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
        let link = $el.find('a').first().attr('href') || url;
        try { link = new URL(link, url).toString(); } catch (e) { link = url; }
        const date = $el.find('time').attr('datetime') || $el.find('.article__timestamp').text() || $('meta[property="article:published_time"]').attr('content') || null;
        const text = $el.find('p').map((i, p) => $(p).text()).get().join('\n\n');
        if (title || text) articles.push({ title, link, date, text });
    });

    return articles.slice(0, 5).map(a => ({
        title: (a.title || '').trim(),
        link: a.link || url,
        date: a.date || new Date().toISOString(),
        text: (a.text || '').trim(),
    }));
}

module.exports = { parseCoindesk };
