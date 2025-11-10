# Global Market Intelligence Scraper (GMIS)

Lightweight Apify Actor to scrape and summarize financial news (forex, crypto, stocks). Designed for development with Hugging Face inference and an OpenAI option for showcase.

Features
- Playwright rendering + Cheerio extraction
- Caching with Apify KeyValueStore (TTL + metadata)
- Batch summarization via Hugging Face with local Python fallback
- Deduplication and cleaning
- Metrics (Prometheus client)

Quick start
1. Install dependencies:

```bash
npm install
# If you can, install Playwright browsers (recommended):
npx playwright install --with-deps

# If Playwright system/browser install fails on your OS, the actor now
# attempts to fall back to an existing system Chromium binary (e.g. /usr/bin/chromium).
# See `npm run check:playwright` for diagnostics and `RUNBOOK.md` for troubleshooting.

Performance & cost tuning
------------------------
- Defaults are tuned for a modern Intel i7 with a small GPU. You can override via env vars:
	- `MAX_CONCURRENCY` (default 5)
	- `BATCH_SIZE` (default 5)
	- `HOST_MIN_DELAY_MS` (per-host minimum delay, default 1000)
	- `OPENAI_MAX_TOKENS_PER_RUN`, `OPENAI_MAX_REQUESTS_PER_RUN`, `OPENAI_MAX_USD_PER_RUN` for cost caps

Run metrics server locally:

```bash
npm run start:metrics
# then open http://localhost:9400/metrics
```
```

2. Set environment variables (use `.env` or Apify actor environment):

- HF_TOKEN=your_hf_token
- MODE=free  # or 'local'
- EXPORT=false

3. Run locally:

```bash
export GMIS_INPUT='{"assets":["https://example.com"],"frequency":"daily"}'
node src/main.js
```

Run tests:

```bash
npm test
```

Deployment
- Package as an Apify Actor and set env vars in the platform. Use `schedule.json` for automated runs.

Security
- Do not commit secrets. Use Apify actor environment variables for production keys.
