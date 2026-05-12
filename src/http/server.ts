import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { prisma } from '../vendor/supabase.js';
import { apiRoutes } from './routes/api.js';
import { oauthRoutes } from './routes/oauth.js';
import { webhookRoutes } from './routes/webhooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const config = getConfig();
  const app = fastify({ loggerInstance: logger });

  await app.register(cookie);
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || origin.endsWith('.bitrix24.ru') || origin === config.APP_BASE_URL) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://api.bitrix24.com', 'https://*.bitrix24.ru'],
        connectSrc: ["'self'", 'https://*.bitrix24.ru', 'https://vibecode.bitrix24.tech'],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ['https://*.bitrix24.ru'],
      },
    },
  });

  app.get('/healthz', async () => {
    if (!config.SKIP_DB_HEALTH) {
      await prisma.$queryRaw`SELECT 1`;
    }
    return {
      status: 'ok',
      db: config.SKIP_DB_HEALTH ? 'skipped' : 'up',
      time: new Date().toISOString(),
    };
  });

  await app.register(oauthRoutes);
  await app.register(webhookRoutes);
  await app.register(apiRoutes);

  const webDist = path.resolve(__dirname, '../web');
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/app/',
    decorateReply: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/app')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'NOT_FOUND' });
  });

  return app;
}
