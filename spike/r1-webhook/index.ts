import Fastify from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = Fastify({ logger: true });
const store = process.env.STORE_PATH || '/data/comm-hub-r2.txt';

app.post('/webhook', async (request) => {
  request.log.info({ body: request.body }, 'WEBHOOK RECEIVED');
  return { ok: true };
});

app.post('/fs/write', async (request) => {
  await fs.mkdir(path.dirname(store), { recursive: true });
  await fs.writeFile(store, JSON.stringify({ at: new Date().toISOString(), data: request.body }));
  return { ok: true, path: store };
});

app.get('/fs/read', async () => {
  try {
    return JSON.parse(await fs.readFile(store, 'utf8')) as unknown;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'read failed' };
  }
});

app.get('/healthz', async () => ({ status: 'ok' }));

setInterval(() => {
  app.log.info({ at: new Date().toISOString() }, 'HB');
}, 30_000);

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
