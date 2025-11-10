# Release notes — GMIS v0.1.1

This release packages the Global Market Intelligence Scraper (GMIS) for submission/demo.

What's included
- CI workflow that installs Playwright browsers, runs tests, runs a deterministic fixture smoke-run, and uploads demo artifacts.
- Playwright-rendered smoke-run (manual) for live e2e testing.
- Tuned scrapers for Coindesk, Cointelegraph, and Yahoo Finance with integration tests.
- OpenAI summarizer with tiktoken/gpt-3-encoder token counting, reservation/cost tracking, Redis atomic reservations (optional), and per-run + per-batch early-cutoffs.
- Local transformer fallback and Dockerfile for offline summarization.
- Prometheus metrics and profiling script that writes JSON and Markdown reports.
- Exporter for JSON->CSV and optional S3 upload.

How to ship (recommended)

1) Run test suite locally

```bash
npm ci
npm test
```

2) Produce demo artifacts (runs deterministic fixtures)

```bash
npm run demo
# makes exports/sample_demo.json
```

3) Produce a profile report (optional)

```bash
npm run profile
# writes exports/profile_report_<ts>.json and .md
```

4) Commit and tag for release

```bash
git add -A
git commit -m "chore(release): v0.1.1 — contest-ready GMIS"
git tag -a v0.1.1 -m "GMIS v0.1.1"
git push origin main --follow-tags
```

5) Create GitHub release (optional)

```bash
# Requires GitHub CLI (gh)
gh release create v0.1.1 --title "GMIS v0.1.1" --notes-file RELEASE.md --assets exports/sample_demo.json --repo <owner>/<repo>
```

6) Publish to Apify (optional)

- Package as an Apify Actor and set environment variables on the Apify platform. Use `apify` CLI or the UI to upload the actor.

Troubleshooting
- If Playwright browsers fail to install on your local OS, run `npm run check:playwright` for diagnostics and consider using system Chromium.

CI guard thresholds
-------------------

The CI now includes a lightweight profile guard that runs after the `profile` job. It checks the latest `exports/profile_report_*.json` and fails the job if either:

- peak memory (MB) exceeds `PROFILE_MAX_MEMORY_MB` (default: 200)
- duration (ms) exceeds `PROFILE_MAX_DURATION_MS` (default: 120000)

You can override thresholds in the workflow by setting these environment variables or repository secrets. The guard script is `scripts/check_profile_guard.js`.

Contact
- For any issues, open a GitHub Issue and include the profile report and demo artifact.

Release
-------

The release for this package is available at: https://github.com/GeoAziz/global-market-intelligence-scraper/releases/tag/v0.1.1

