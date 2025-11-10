# Publishing GMIS as an Apify Actor — checklist & instructions

This document explains the steps to package and publish the Global Market Intelligence Scraper (GMIS) as an Apify Actor. It doesn't perform the publish itself; follow these instructions when you're ready to deploy.

Prerequisites
- An Apify account and access to create/edit Actors
- `apify-cli` installed locally (optional but convenient): `npm i -g apify-cli`
- Docker installed if you plan to run the local transformer or custom runtime in a container
- Repo cloned and dependencies installed locally for testing

Important environment variables
These must be provided to the Actor as secrets (Apify UI or `apify-cli`):

- `HUGGINGFACE_API_TOKEN` — Hugging Face Inference API token (for HF summarizer)
- `OPENAI_API_KEY` — OpenAI API key (optional; used only if enabled)
- `S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` — optional, for S3 exporter
- `REDIS_URL` — optional, to enable Redis-backed atomic reservations for OpenAI usage tracker
- `DEBUG_HTML` — optional, `true` to save rendered HTML for debugging
- `MAX_CONCURRENCY`, `BATCH_SIZE`, `OPENAI_MAX_USD_PER_RUN` — tune to control cost and concurrency

Suggested `apify.json` / Actor manifest
Create an `apify.json` at the repo root (or use the UI). Example manifest (minimal):

```json
{
  "name": "gmis",
  "version": "0.1.1",
  "title": "Global Market Intelligence Scraper",
  "build": {
    "nodeVersion": "20",
    "main": "src/main.js"
  },
  "env": {
    "HUGGINGFACE_API_TOKEN": "",
    "OPENAI_API_KEY": "",
    "S3_BUCKET": "",
    "REDIS_URL": ""
  }
}
```

Notes about runtime and memory
- The actor uses Playwright for rendering. Apify's standard Node.js autoscaled runtime supports Playwright, but you may need to pick an instance type with enough memory when using Playwright and local transformers.
- If you plan to run the optional local transformer (Python) inside the Actor, prefer a Docker-based Actor and a larger memory setting (e.g., 4GB+). The project includes a Dockerfile for the local transformer fallback. Alternatively, keep `mode=local` disabled and prefer HF/OpenAI.

Publishing steps (apify-cli)
1. Ensure you're logged in: `apify login` (follow the web auth flow).
2. Build and test locally:

```bash
npm ci
npm test
npm run demo   # deterministic fixture smoke-run
```

3. (Optional) Test with Apify local run:

```bash
apify run --docker     # runs using apify runtime locally
```

4. Create/update the actor on Apify and push the code:

```bash
apify create "GMIS"    # first-time only, or use the web UI
apify push --tag v0.1.1
```

5. Configure the Actor's environment variables in the Apify Console (Secrets) — add the keys listed above.

6. Test a run from the Apify Console. Use a small set of URLs or `mode=fixtures` to verify behavior without external APIs.

Security & cost controls
- Set `OPENAI_MAX_USD_PER_RUN` to a conservative value to prevent expensive OpenAI usage. The code will pre-check and fall back to the local extractive summarizer if the estimated cost exceeds the cap.
- Use the optional `REDIS_URL` if you expect concurrent runs to share an OpenAI budget; Redis-backed reservations provide atomic pre-reservation.
- Prefer the HF summarizer for lower-cost/no-cost summarization where possible (free-tier limits apply).

CI / GitHub Actions integration
- The repo already contains `.github/workflows/ci.yml` that installs Playwright browsers and runs deterministic fixtures. When publishing the actor, consider adding workflow secrets for Apify push if you want to automate publishing from CI (not recommended for public repos without extra safeguards).

Troubleshooting
- If Playwright browsers fail to install, the code can fallback to system Chromium; use `npm run check:playwright` to diagnose.
- If runs fail due to missing Actor API initialization warnings, ensure `APIFY_TOKEN` is provided when using Apify SDK features locally or in the Actor runtime.

Post-publish checklist
- Monitor the first few runs for memory and execution time; adjust Actor memory/timeout if needed.
- Verify secrets and exporter permissions (S3 IAM policy) before enabling S3 uploads in production runs.

If you want, I can also prepare an `apify.json` manifest file and a short `apify-publish.sh` helper script that prompts for required secrets and runs `apify push` (I left this out since you preferred to do the publish later).
