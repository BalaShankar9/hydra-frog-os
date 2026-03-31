/**
 * Lightweight HTTP health check server for workers.
 * Exposes /healthz (liveness) and /readyz (readiness) on a configurable port.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';

interface HealthCheckOptions {
  port: number;
  service: string;
  isReady?: () => boolean;
}

export function startHealthServer({ port, service, isReady }: HealthCheckOptions) {
  const startTime = Date.now();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || '';

    if (url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service,
        uptime: Math.round((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    if (url === '/readyz') {
      const ready = isReady ? isReady() : true;
      const status = ready ? 200 : 503;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: ready ? 'ready' : 'not_ready',
        service,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(`[${service}] Health server listening on :${port}/healthz`);
  });

  return server;
}
