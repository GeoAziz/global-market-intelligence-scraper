const fs = require('fs');
const path = require('path');
const { parseCointelegraph } = require('../../src/scrapers/cointelegraphScraper');

test('cointelegraph parser extracts JSON-LD article', () => {
    const html = fs.readFileSync(path.join(__dirname, '../fixtures/cointelegraph.html'), 'utf8');
    const res = parseCointelegraph(html, 'https://cointelegraph.com/sample');
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    const first = res[0];
    expect(first.title.toLowerCase()).toContain('bitcoin');
    expect(first.text).toContain('rallied strongly');
});
