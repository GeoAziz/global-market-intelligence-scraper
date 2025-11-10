const fetch = require('node-fetch');
const cheerio = require('cheerio');
const log = require('../utils/logger');

class CheerioCrawler {
    constructor(opts = {}) {
        this.handlePageFunction = opts.handlePageFunction;
        this.requestList = opts.requestList || [];
        this.maxConcurrency = opts.maxConcurrency || 5;
        this.maxRequestsPerCrawl = opts.maxRequestsPerCrawl || Infinity;
    }

    async run() {
        const sources = Array.isArray(this.requestList) ? this.requestList : (this.requestList?.sources || []);
        const urls = sources.map(s => (typeof s === 'string' ? s : (s.url || s.request?.url)) ).filter(Boolean);

        let index = 0;
        const workers = Array.from({ length: this.maxConcurrency }, () => this._worker(urls, () => index++));
        await Promise.all(workers);
    }

    _worker(urls, nextIndexGetter) {
        return (async () => {
            while (true) {
                const idx = nextIndexGetter();
                if (idx >= urls.length || idx >= this.maxRequestsPerCrawl) break;
                const url = urls[idx];
                try {
                    log.info('Fallback crawler fetching', { url });
                    const res = await fetch(url, { timeout: 30000 });
                    const body = await res.text();
                    const $ = cheerio.load(body);
                    await this.handlePageFunction({ request: { url }, body, $ });
                } catch (err) {
                    log.error('Fallback crawler error', { url, err: err && err.message });
                }
            }
        })();
    }
}

module.exports = CheerioCrawler;
