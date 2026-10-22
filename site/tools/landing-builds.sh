#!/usr/bin/env bash
# The three builds the landing page is reviewed and tested against (Phase 7), from site/:
#   dist-test   unfinished content shown (TODO notes in the slots), base "/"            -> most e2e specs
#   dist-prod   production, under the project base path (as on GitHub Pages)            -> e2e/prod.spec.ts
#   dist-empty  production, base "/": the prose slots hidden, as deployed today          -> "empty" screenshots
#   dist-ph     development, unfinished content shown, the landing slots filled with
#               bracketed placeholder text (SITE_PLACEHOLDERS=1)                         -> "filled" screenshots
set -euo pipefail
SITE_SHOW_TODO=1 npx vite build --mode development --outDir dist-test --emptyOutDir --logLevel warn
MSYS_NO_PATHCONV=1 BASE_PATH=/oberth-efficiency-atlas/ npx vite build --outDir dist-prod --emptyOutDir --logLevel warn
npx vite build --outDir dist-empty --emptyOutDir --logLevel warn
SITE_SHOW_TODO=1 SITE_PLACEHOLDERS=1 npx vite build --mode development --outDir dist-ph --emptyOutDir --logLevel warn
echo "built dist-test, dist-prod, dist-empty, dist-ph"
