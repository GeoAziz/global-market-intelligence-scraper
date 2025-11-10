# RUNBOOK — GMIS Actor

Quick operational instructions for running GMIS locally and on Apify.

Local run
---------
1. Install Node dependencies and Playwright browsers:

```bash
npm install
npx playwright install --with-deps
```

If `npx playwright install --with-deps` fails on your OS (missing apt packages
or unsupported distro), you have two options:

- Install Playwright browsers on a supported runner (CI or a Ubuntu 20.04/22.04 host) where the command succeeds.
- Or use a system Chromium already present on the host. The actor now supports
	a fallback to system Chromium. To diagnose which path will be used, run:

```bash
npm run check:playwright
```

The command prints JSON diagnostics and exit codes:

- exit 0: Playwright launched successfully (either bundled browsers or system Chromium).
- exit 2: Playwright cannot launch bundled browsers; system Chromium launch failed.
- exit 3: Playwright launch failed and no system Chromium found.

If system Chromium is available (for example `/usr/bin/chromium`), the actor
will attempt to use it with `--no-sandbox` flags. This works for many local
developer machines and CI environments where installing Playwright's browsers
is impractical.

2. Provide env vars (use `.env` in development):

```
HF_TOKEN=...
MODE=free
EXPORT=false
```

3. Run:

```bash
export GMIS_INPUT='{"assets":["forex","crypto"],"frequency":"daily"}'
node src/main.js
```

Monitoring
----------
- Metrics available via Prometheus client if you expose them in a local debug server. Counters include `gmis_hf_calls_total`, `gmis_cache_hits_total`, `gmis_articles_processed_total`.

Failure recovery
----------------
- If HF calls fail repeatedly, circuit breaker will open and local fallback will be used.
- Check logs (stdout or rotated files) for error details and stack traces.

Profiling and recommended defaults
---------------------------------
This project is intended to run well on a modern Intel i7 with a small GPU. Below are recommended defaults and how to tune them.

- Concurrency:
	- MAX_CONCURRENCY=5 — reasonable default for CPU-bound rendering with Playwright on an i7.
	- If you have more CPU cores or a stronger GPU, you can raise this number; if you see high memory usage or OOMs, reduce it.

- Summarization batching:
	- BATCH_SIZE=5 — balances parallelism and API cost. Larger batches increase throughput but may increase peak memory and API token usage.

- Per-host politeness:
	- HOST_MIN_DELAY_MS=1000 — default per-host minimum delay in ms. Increase for aggressive sites or to be extra polite.

- Timeouts:
	- Page navigation timeout: 30000 ms. Increase on slow networks or reduce to fail fast on timeouts.

- OpenAI cost control:
	- OPENAI_MAX_USD_PER_RUN — set to a conservative number (e.g., 1.0) to avoid accidental spend during demos.
	- OPENAI_USD_PER_1K_TOKENS — set based on your chosen model's pricing; default used in code is a conservative estimate if unset.

How to profile locally
----------------------
1. Run the demo with debug logging:

```bash
LOG_LEVEL=debug npm run demo
```

2. Monitor system resources (Linux):

```bash
htop  # or top
watch -n 1 "ps aux --sort=-%mem | head -n 10"
```

3. Increase or decrease `MAX_CONCURRENCY` and `BATCH_SIZE` and re-run to observe peak memory and CPU.

If you want, I can add a tiny script that runs a CPU/memory profile for a short demo run and writes a short report. This is optional and helpful if you want exact numbers for contest submission.

Apify deployment
----------------
- Add secrets via Apify dashboard (HF_TOKEN, OPENAI_KEY).
- Use `apify.json` and `schedule.json` to control frequency.
