const path = require('path');
const fs = require('fs');
const { parseYahooFinance } = require('../../src/scrapers/yahooFinanceScraper');

test('Yahoo scraper extracts title and text from fixture', () => {
  const fixture = path.join(__dirname, '..', 'fixtures', 'yahoo.html');
  const html = fs.readFileSync(fixture, 'utf8');
  const articles = parseYahooFinance(html, `file://${fixture}`);
  expect(Array.isArray(articles)).toBe(true);
  expect(articles.length).toBeGreaterThan(0);
  const a = articles[0];
  expect(a.title && a.title.length).toBeGreaterThan(10);
  expect(a.text && a.text.length).toBeGreaterThan(10);
});
