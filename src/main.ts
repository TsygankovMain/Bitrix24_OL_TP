import { getConfig } from './config.js';
import { logger } from './logger.js';
import { buildServer } from './http/server.js';
import { ImapPoller } from './workers/imapPoller.js';
import { TokenRefresher } from './workers/tokenRefresher.js';
import { prisma } from './vendor/supabase.js';

async function main(): Promise<void> {
  const config = getConfig();
  const app = await buildServer();
  const imapPoller = new ImapPoller(prisma, config);
  const tokenRefresher = new TokenRefresher(prisma, config);

  if (!config.DISABLE_WORKERS) {
    imapPoller.start();
    tokenRefresher.start();
  } else {
    logger.warn('background workers disabled by DISABLE_WORKERS=true');
  }

  const address = await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info({ address }, 'comm hub started');
}

main().catch((error: unknown) => {
  logger.error({ error }, 'fatal startup error');
  process.exit(1);
});
