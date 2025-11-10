const fs = require('fs');
const path = require('path');
const { parseCoindesk } = require('../../src/scrapers/coindeskScraper');

test('coindesk parser extracts JSON-LD article', () => {
    const html = fs.readFileSync(path.join(__dirname, '../fixtures/coindesk.html'), 'utf8');
    const res = parseCoindesk(html, 'https://www.coindesk.com/sample');
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    const first = res[0];
    expect(first.title.toLowerCase()).toContain('ethereum');
    expect(first.text).toContain('strong inflows');
});
