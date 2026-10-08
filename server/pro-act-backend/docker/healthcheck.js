// Docker HEALTHCHECK for both process roles (see Dockerfile): exit 0 when the probe answers 2xx.
'use strict';
const worker = process.env.PROCESS_ROLE === 'worker';
const url = worker
  ? `http://127.0.0.1:${process.env.WORKER_PORT || 4005}/health/ready`
  : `http://127.0.0.1:${process.env.PORT || 4004}/api/health`;

fetch(url)
  .then((res) => process.exit(res.ok ? 0 : 1))
  .catch(() => process.exit(1));
