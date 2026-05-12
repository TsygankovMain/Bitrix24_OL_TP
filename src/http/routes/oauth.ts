import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../../config.js';
import { InstallFlow } from '../../domain/portal/InstallFlow.js';
import { registerEmailConnector } from '../../domain/connector/ConnectorRegistration.js';
import { B24RestClient } from '../../vendor/b24.js';
import { prisma } from '../../vendor/supabase.js';
import { decryptSecret } from '../../crypto.js';

const installQuerySchema = z.object({
  code: z.string().min(1),
  domain: z.string().min(1).optional(),
  DOMAIN: z.string().min(1).optional(),
  member_id: z.string().optional(),
  application_token: z.string().optional(),
});

export function oauthRoutes(app: FastifyInstance): void {
  app.get('/oauth/install', async (request, reply) => {
    const config = getConfig();
    const query = installQuerySchema.parse(request.query);
    const domain = query.domain ?? query.DOMAIN;
    if (!domain) {
      return reply.code(400).send({ error: 'DOMAIN_REQUIRED' });
    }

    const flow = new InstallFlow(prisma, {
      clientId: config.B24_CLIENT_ID,
      clientSecret: config.B24_CLIENT_SECRET,
      masterKeyBase64: config.MASTER_ENCRYPTION_KEY_BASE64,
    });
    const installed = await flow.install({
      code: query.code,
      domain,
      applicationToken: query.application_token,
    });
    const portal = await prisma.portal.findUniqueOrThrow({ where: { id: installed.portalId } });
    const accessToken = await decryptSecret(
      portal.accessToken,
      config.MASTER_ENCRYPTION_KEY_BASE64,
    );
    const b24 = new B24RestClient({ domain: portal.domain, accessToken });
    await registerEmailConnector(b24, { appBaseUrl: config.APP_BASE_URL });

    return reply.redirect(`${config.APP_BASE_URL}/app#/settings`);
  });
}
