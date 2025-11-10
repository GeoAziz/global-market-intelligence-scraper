const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { summarizeBatch } = require('../src/summarizer');
const { cleanText } = require('../src/cleaner');

// Map fixture filename prefixes to parser modules
const parserMap = {
    'cointelegraph': require('../src/scrapers/cointelegraphScraper').parseCointelegraph,
    'coindesk': require('../src/scrapers/coindeskScraper').parseCoindesk,
    'yahoo': require('../src/scrapers/yahooFinanceScraper').parseYahooFinance,
};

async function run() {
    const fixturesDir = path.join(__dirname, '..', 'test', 'fixtures');
    const out = [];
    const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.html'));
    for (const f of files) {
        const name = f.replace(/\.html$/, '');
        const filePath = path.join(fixturesDir, f);
        const hostKey = Object.keys(parserMap).find(k => name.toLowerCase().includes(k)) || 'generic';
        const html = fs.readFileSync(filePath, 'utf8');
        let articles = [];
        try {
            if (hostKey === 'generic') {
                const { parseRenderedPage } = require('../src/scrapers/genericScraper');
                articles = parseRenderedPage(html, `file://${filePath}`);
            } else {
                const parser = parserMap[hostKey];
                articles = parser(html, `file://${filePath}`);
            }
        } catch (e) {
            log.error('Fixture parser failed', { file: f, err: e && e.message });
            continue;
        }
        // Clean results
        const cleaned = articles.map(a => ({
            asset: name,
            title: (a.title || '').trim(),
            link: a.link || `file://${filePath}`,
            date: a.date || new Date().toISOString(),
            text: cleanText(a.text || ''),
            scrapedAt: new Date().toISOString(),
        }));
        // Summarize locally (avoid external API in CI fixtures)
        const summaries = await summarizeBatch(cleaned, { batchSize: 5, mode: process.env.MODE || 'local' });
        for (const s of summaries) out.push(s);
    }

    const outDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `ci_smoke_output_${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log('Fixture smoke-run produced', out.length, 'items. Output:', outFile);
    process.exit(out.length > 0 ? 0 : 2);
}

run().catch(e => {
    console.error('Fixture smoke-run failed', e && e.stack);
    process.exit(3);
});
