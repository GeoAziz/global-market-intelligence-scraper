#!/usr/bin/env bash
set -euo pipefail

# Helper to push this repo as an Apify Actor using apify-cli.
# Usage: ./apify-publish.sh [--tag <tag>] [--no-push]

TAG="v0.1.1"
NO_PUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --no-push) NO_PUSH=1; shift 1 ;;
    -h|--help) echo "Usage: $0 [--tag <tag>] [--no-push]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

if ! command -v apify >/dev/null 2>&1; then
  echo "apify CLI not found. Install it with: npm i -g apify-cli" >&2
  exit 3
fi

if [[ -z "${APIFY_TOKEN:-}" ]]; then
  echo "APIFY_TOKEN not set. Export your Apify token (or run 'apify login') and retry." >&2
  exit 4
fi

echo "Preparing to push Actor with tag ${TAG}..."

if [[ $NO_PUSH -eq 1 ]]; then
  echo "Dry run mode (--no-push). Skipping apify push.";
  exit 0;
fi

apify push --tag "${TAG}"
echo "apify push finished. Verify the Actor on Apify Console." 
