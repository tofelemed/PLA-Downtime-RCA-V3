import * as http from 'http';
import { AddressInfo } from 'net';

export interface RecordedRequest {
  method: string;
  url: string;
  authorization?: string;
}

export interface FakePiServer {
  /** `http://127.0.0.1:<port>/piwebapi` — what a pi_connections row stores */
  baseUrl: string;
  origin: string;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

const BIG_BODY_BYTES = 6 * 1024 * 1024;

/** Minimal PI Web API stand-in: `/piwebapi/assetservers` answers, `/piwebapi/streams/big/*` answers with 6 MiB. */
export async function startFakePiServer(): Promise<FakePiServer> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    const url = req.url ?? '';
    requests.push({
      method: req.method ?? '',
      url,
      authorization: req.headers.authorization,
    });
    res.setHeader('Content-Type', 'application/json');
    if (url.startsWith('/piwebapi/streams/big')) {
      res.writeHead(200);
      res.end(JSON.stringify({ Items: 'x'.repeat(BIG_BODY_BYTES) }));
      return;
    }
    if (url.startsWith('/piwebapi/assetservers')) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          Items: [{ Name: 'PI-AF-01', WebId: 'F1RSAssetServer' }],
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ Errors: [`No route for ${url}`] }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  return {
    baseUrl: `${origin}/piwebapi`,
    origin,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
