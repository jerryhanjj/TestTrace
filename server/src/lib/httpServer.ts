import http from 'node:http';

import type { GenerateLabelsRequest, GenerateLabelsResponse, ParsePreviewRequest, ParsePreviewResponse } from './types';
import { buildGenerateLabels, buildParsePreview } from './service';

export interface BackendServerHandle {
  baseUrl: string;
  dispose(): Promise<void>;
}

export async function startBackendServer(
  _dataDir: string,
  options?: {
    host?: string;
    port?: number;
  }
): Promise<BackendServerHandle> {
  const host = options?.host ?? '127.0.0.1';
  const port = options?.port ?? 0;
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/health') {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && request.url === '/parse-preview') {
        const payload = await readJson<ParsePreviewRequest>(request);
        const result = await buildParsePreview(payload);
        sendJson<ParsePreviewResponse>(response, 200, result);
        return;
      }

      if (request.method === 'POST' && request.url === '/generate-labels') {
        const payload = await readJson<GenerateLabelsRequest>(request);
        const result = await buildGenerateLabels(payload);
        sendJson<GenerateLabelsResponse>(response, 200, result);
        return;
      }

      sendJson(response, 404, { message: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected backend error';
      sendJson(response, 500, { message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine backend server address.');
  }

  return {
    baseUrl: `http://${host}:${address.port}`,
    dispose: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

async function readJson<T>(request: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) {
    throw new Error('Request body is empty.');
  }
  return JSON.parse(body) as T;
}

function sendJson<T>(response: http.ServerResponse, statusCode: number, payload: T): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}