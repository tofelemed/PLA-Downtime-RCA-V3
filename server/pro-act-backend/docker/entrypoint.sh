#!/bin/sh
# Selects the process to run from PROCESS_ROLE (see src/common/scheduling/process-role.ts):
#   api    -> dist/src/main.js    HTTP API, schedulers off
#   worker -> dist/src/worker.js  schedulers only, health probes on WORKER_PORT (default 4005)
#   all    -> dist/src/main.js    both in one process (default when unset)
# `exec` makes node PID 1 so SIGTERM from `docker stop` reaches the Nest shutdown hooks.
set -eu

role="${PROCESS_ROLE:-all}"
case "$role" in
  api|all) exec node dist/src/main.js "$@" ;;
  worker)  exec node dist/src/worker.js "$@" ;;
  *)
    echo "PROCESS_ROLE must be api, worker or all (got '$role')" >&2
    exit 64
    ;;
esac
