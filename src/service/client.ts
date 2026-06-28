import http from 'node:http';

import type {
  GenerateLabelsRequest,
  GenerateLabelsResponse,
  ParsePreviewRequest,
  ParsePreviewResponse
} from '../types';

export class TestTraceServiceClient {
  public constructor(private readonly baseUrl: string) {}

  public async parsePreview(request: ParsePreviewRequest): Promise<ParsePreviewResponse> {
    return this.post('/parse-preview', request);
  }

  public async generateLabels(request: GenerateLabelsRequest): Promise<GenerateLabelsResponse> {
    return this.post('/generate-labels', request);
  }

  private async post<TResponse>(pathname: string, payload: unknown): Promise<TResponse> {
    const url = new URL(pathname, this.baseUrl);
    const body = JSON.stringify(payload);

    return new Promise<TResponse>((resolve, reject) => {
      const request = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            const data = text ? JSON.parse(text) as TResponse | { message?: string } : {};
            if ((response.statusCode ?? 500) >= 400) {
              reject(new Error((data as { message?: string }).message ?? `Backend request failed with ${response.statusCode}`));
              return;
            }
            resolve(data as TResponse);
          });
        }
      );

      request.on('error', (error) => {
        reject(new Error(
          `Could not reach the TestTrace service at ${this.baseUrl}. Start the standalone service before using the plugin. Original error: ${error.message}`
        ));
      });
      request.write(body);
      request.end();
    });
  }
}