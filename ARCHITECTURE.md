# GMIS Architecture

Overview
--------
GMIS is organized into small modules with clear responsibilities:

- `src/scraper.js` — Playwright rendering + Cheerio parsing. Produces raw article objects.
- `src/cleaner.js` — Normalizes text, removes duplicates (fuzzy dedup), prepares records for summarization.
- `src/summarizer.js` — Batch summarization. Checks cache, calls HF inference API with retry and circuit-breaker, falls back to local summarizer or extractive summarizer.
- `src/cache.js` — Apify KeyValueStore wrapper with metadata and TTL.
- `src/output.js` — Pushes structured records to Apify Dataset and optional export to JSON/CSV.
- `src/metrics.js` — Prometheus metrics counters for observability.
- `src/local_summarizer.py` — Optional Python fallback using Hugging Face Transformers for local inference.

Data Flow
---------
Input (Actor) -> `scraper` (render & extract) -> `cleaner` (normalize & dedupe) -> `summarizer` (cache check -> HF or local -> cache) -> `output` (dataset + optional export)

Caching & Provenance
- Cache entries include `{summary, model, modelVersion, cachedAt, ttlSeconds}`.
- Dataset records include provenance fields (`summaryModel`, `scrapedAt`, `processedAt`).

Resilience
- HF API calls use p-retry and an opossum circuit-breaker to avoid cascading failures.
- Playwright navigation has retry.
