const cheerio = require('cheerio');

function parseCointelegraph(html, url) {
    const $ = cheerio.load(html || '');
    const articles = [];

    // Cointelegraph often includes JSON-LD
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const j = JSON.parse($(el).contents().text());
            if (Array.isArray(j)) {
                for (const item of j) {
                    if (item['@type'] && (item['@type'] === 'NewsArticle' || item['@type'] === 'Article')) {
                        const title = item.headline || item.name || $('title').text();
                        const link = item.mainEntityOfPage || url;
                        const date = item.datePublished || null;
                        const text = item.articleBody || '';
                        articles.push({ title, link, date, text });
                    }
                }
            } else if (j['@type'] && (j['@type'] === 'NewsArticle' || j['@type'] === 'Article')) {
                const title = j.headline || j.name || $('title').text();
                const link = j.mainEntityOfPage || url;
                const date = j.datePublished || null;
                const text = j.articleBody || '';
                articles.push({ title, link, date, text });
            }
        } catch (e) {}
    });

    // Simple fallback
    $('article').each((i, el) => {
        const title = $(el).find('h1, h2').first().text().trim();
        const link = $(el).find('a').first().attr('href') || url;
        const date = $(el).find('time').attr('datetime') || null;
        const text = $(el).find('p').map((i, p) => $(p).text()).get().join('\n\n');
        if (title || text) articles.push({ title, link, date, text });
    });

    return articles.slice(0, 5).map(a => ({
        title: (a.title || '').trim(),
        link: a.link || url,
        date: a.date || new Date().toISOString(),
        text: (a.text || '').trim(),
    }));
}

module.exports = { parseCointelegraph };
