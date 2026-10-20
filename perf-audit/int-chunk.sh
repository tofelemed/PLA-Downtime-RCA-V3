#!/usr/bin/env bash
# Runs one chunk of the backend integration specs on the throwaway test database (test:int setup), so the
# full suite can be run piece by piece instead of in one long run.
#   perf-audit/int-chunk.sh <chunk> <chunks>    e.g. perf-audit/int-chunk.sh 1 8
set -uo pipefail
CHUNK="$1"; CHUNKS="$2"
cd "$(dirname "${BASH_SOURCE[0]}")/../server/pro-act-backend"
mapfile -t ALL < <(ls test/integration/*.int-spec.ts | sort)
TOTAL=${#ALL[@]}
SIZE=$(( (TOTAL + CHUNKS - 1) / CHUNKS ))
START=$(( (CHUNK - 1) * SIZE ))
FILES=("${ALL[@]:START:SIZE}")
echo "chunk $CHUNK/$CHUNKS: ${#FILES[@]} of $TOTAL specs (${FILES[0]##*/} .. ${FILES[-1]##*/})"
npm run testdb:up > /dev/null 2>&1
npx cross-env TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=5434 TEST_DB_USERNAME=postgres TEST_DB_PASSWORD=postgres \
  jest --selectProjects integration --runInBand "${FILES[@]}" 2>&1 \
  | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "^(FAIL|Tests:|Test Suites:)|^  ● .* › " | sort -u
