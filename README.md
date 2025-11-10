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

Demo and quick judge run
------------------------

This repository includes a deterministic demo that uses saved HTML fixtures and the local summarizer so judges can run it without API keys.

1. Install deps:

```bash
npm install
```

2. Run the demo (uses fixtures, no external APIs by default):

```bash
npm run demo
# This runs the fixture smoke-run and writes `exports/sample_demo.json`.
```

3. Inspect the sample output:

```bash
cat exports/sample_demo.json
```

Exporting and uploading
-----------------------

Convert the sample demo JSON to CSV and optionally upload to S3:

```bash
npm run export
# To upload, set S3_BUCKET and AWS credentials in the environment and run:
S3_BUCKET=my-bucket AWS_REGION=us-east-1 npm run export:upload
```

Mode selection and safety
-------------------------

By default the demo runs in `local` mode (no external LLM). To use OpenAI or Hugging Face in a real run, set the relevant env vars:

- `OPENAI_KEY` — your OpenAI API key (optional)
- `HF_TOKEN` — Hugging Face Inference API token (optional)
- `MODE` — one of `local`, `free` (Hugging Face), or `openai`

Safety / spend controls
-----------------------

Set these environment variables to cap per-run spend and tokens:

- `OPENAI_MAX_TOKENS_PER_REQUEST` (default ~1024)
- `OPENAI_MAX_REQUESTS_PER_RUN` (default 50)
- `OPENAI_MAX_TOKENS_PER_RUN` (default 100000)
- `OPENAI_MAX_USD_PER_RUN` (optional float)

Disable raw persistence
-----------------------

To avoid storing raw HTML or raw scraped text in the dataset, set:

```bash
PERSIST_RAW=false
```

Secrets and CI
--------------

For running CI and optional features, configure these secrets in GitHub Actions (or in your `.env` locally):

- `OPENAI_KEY` — (optional) OpenAI API key for `MODE=openai`
- `HF_TOKEN` — (optional) Hugging Face token for `MODE=free`
- `REDIS_URL` — (optional) Redis connection string if you want atomic OpenAI usage reservations across runners
- `S3_BUCKET` and `AWS_*` credentials — (optional) to enable upload in `npm run export`

If `REDIS_URL` is not provided, the tracker will fall back to Apify KeyValueStore-based best-effort reservations.

Troubleshooting
---------------

- If Playwright browser install fails on your OS, run `npm run check:playwright` to see diagnostics and the path to any system Chromium binary.
- For CI reproducibility, use the fixture-based smoke-run (runs in the CI workflow by default). The Playwright-rendered smoke job is manual and can be triggered with the `playwright=true` input on the workflow dispatch.

