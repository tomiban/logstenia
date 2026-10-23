#!/usr/bin/env bash
# Local Worker for the two-device sync e2e (`playwright.sync.config.ts`).
#
# Uses its own D1 under a temp directory so a run starts from an empty mirror and never
# touches the developer's `.wrangler` database. The bypass flag is the same one
# `npm run dev` passes; see worker/README.md.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
persist="${SYNC_E2E_PERSIST:-$(mktemp -d)}"
mkdir -p "$persist"

cd "$repo_root/worker"
npx wrangler d1 migrations apply logstenia-sync --local --persist-to "$persist"
exec npx wrangler dev --port 8787 --persist-to "$persist" --var SYNC_DEV_NO_AUTH:true
