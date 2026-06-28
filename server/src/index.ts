import path from 'node:path';

import { startBackendServer } from './lib/httpServer';

const host = process.env.TESTTRACE_HOST ?? '127.0.0.1';
const port = Number(process.env.TESTTRACE_PORT ?? '43125');
const dataDir = process.env.TESTTRACE_DATA_DIR ?? path.join(process.cwd(), '.data');

async function main(): Promise<void> {
  const handle = await startBackendServer(dataDir, { host, port });

  console.log(`TestTrace service listening at ${handle.baseUrl}`);
  console.log(`TestTrace data directory: ${dataDir}`);

  const shutdown = async () => {
    await handle.dispose();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});