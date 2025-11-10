const cheerio = require('cheerio');

function parseYahooFinance(html, url) {
    const $ = cheerio.load(html || '');
    const articles = [];

    // Yahoo Finance article pages often include article body in .caas-body or article tags
    $('article, .caas-body, .caas-asset-text, .LfP32e, .M(0)').each((i, el) => {
        const $el = $(el);
        let title = $el.find('h1, h2').first().text().trim() || $('meta[property="og:title"]').attr('content') || $('title').text().trim();
        let link = $el.find('a').first().attr('href') || url;
        try { link = new URL(link, url).toString(); } catch (e) { link = url; }
        const date = $el.find('time').attr('datetime') || $el.find('.C(#959595)').text() || $('meta[property="article:published_time"]').attr('content') || null;
        const text = $el.find('p').map((i, p) => $(p).text()).get().join('\n\n');
        if (title || text) articles.push({ title, link, date, text });
    });

    // JSON-LD fallback
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const j = JSON.parse($(el).contents().text());
            if (j && (j['@type'] === 'NewsArticle' || j['@type'] === 'Article')) {
                const title = j.headline || j.name || $('title').text();
                const link = j.mainEntityOfPage || url;
                const date = j.datePublished || null;
                const text = j.articleBody || '';
                articles.push({ title, link, date, text });
            }
        } catch (e) {}
    });

    return articles.slice(0, 5).map(a => ({
        title: (a.title || '').trim(),
        link: a.link || url,
        date: a.date || new Date(a.date || Date.now()).toISOString(),
        text: (a.text || '').trim(),
    }));
}

module.exports = { parseYahooFinance };
