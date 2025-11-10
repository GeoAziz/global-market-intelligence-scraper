const cheerio = require('cheerio');
const { cleanText } = require('../cleaner');

/**
 * parseRenderedPage extracts candidate articles from rendered HTML.
 * Returns array of { title, link, date, text }
 */
function parseRenderedPage(html, url) {
    const $ = cheerio.load(html || '');
    const pageTitle = ($('h1').first().text() || $('title').text() || '').trim();
    const articles = [];

    $('article').slice(0, 8).each((i, el) => {
        const $el = $(el);
        const title = ($el.find('h1, h2, h3').first().text() || '').trim();
        const link = $el.find('a').first().attr('href') || url;
        const date = $el.find('time').attr('datetime') || $el.find('time').text() || null;
        const text = $el.find('p').map((i, p) => $(p).text()).get().join('\n\n');
        if (title || text) articles.push({ title: title || pageTitle, link, date, text });
    });

    if (articles.length === 0) {
        $('h2').slice(0, 8).each((i, el) => {
            const $el = $(el);
            const title = $el.text().trim();
            const link = $el.find('a').first().attr('href') || url;
            const snippet = $el.next('p').text() || '';
            if (title) articles.push({ title, link, date: null, text: snippet });
        });
    }

    // Normalize and clean
    return articles.map(a => ({
        title: (a.title || '').trim(),
        link: a.link || url,
        date: a.date || new Date().toISOString(),
        text: cleanText([a.title, a.text].filter(Boolean).join('\n\n')),
    })).slice(0, 5);
}

module.exports = { parseRenderedPage };
