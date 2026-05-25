import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../../config.js';
import { decryptSecret, encryptSecret } from '../../crypto.js';
import { parseBotConfiguration } from '../../domain/bot/BotConfiguration.js';
import {
  EMAIL_CONNECTOR_ID,
  setEmailConnectorActive,
} from '../../domain/connector/ConnectorRegistration.js';
import { B24RestClient, mapOpenLineHistory, mapRecentDialogs } from '../../vendor/b24.js';
import { VibeCodeClient } from '../../vendor/vibecode.js';
import { prisma } from '../../vendor/supabase.js';
import { getBearerToken, signSession, verifySession } from '../auth.js';
import type { JsonObject, JsonValue } from '../../types.js';

const sessionSchema = z.object({
  memberId: z.string().min(1),
  domain: z.string().min(1),
  authId: z.string().min(1).optional(),
});

const mailboxSchema = z.object({
  email: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive(),
  imapUser: z.string().min(1),
  imapPassword: z.string().min(1),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  useSsl: z.boolean().default(true),
  olLineId: z.number().int().positive(),
});

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(20_000),
});

const chatParamsSchema = z.object({
  chatId: z.coerce.number().int().positive(),
});

const dialogParamsSchema = z.object({
  dialogId: z.string().min(1),
});

interface AuthContext {
  portalId: string;
  domain: string;
  b24: B24RestClient;
}

async function getAuthContext(request: FastifyRequest): Promise<AuthContext> {
  const config = getConfig();
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('Missing bearer token');
  }
  const claims = verifySession(token, config.JWT_SECRET);
  const portal = await prisma.portal.findUniqueOrThrow({ where: { id: claims.portalId } });
  const accessToken = await decryptSecret(portal.accessToken, config.MASTER_ENCRYPTION_KEY_BASE64);
  return {
    portalId: portal.id,
    domain: portal.domain,
    b24: new B24RestClient({ domain: portal.domain, accessToken }),
  };
}

export function apiRoutes(app: FastifyInstance): void {
  app.post('/api/session', async (request, reply) => {
    const config = getConfig();
    const body = sessionSchema.parse(request.body);
    const portal = await prisma.portal.findUnique({ where: { b24MemberId: body.memberId } });
    if (!portal || portal.domain !== body.domain) {
      return reply.code(401).send({ error: 'PORTAL_NOT_INSTALLED' });
    }
    const token = signSession(
      { portalId: portal.id, memberId: portal.b24MemberId, domain: portal.domain },
      config.JWT_SECRET,
    );
    return { token, expiresIn: 900 };
  });

  app.get('/api/inbox/dialogs', async (request) => {
    const context = await getAuthContext(request);
    const result = await context.b24.callMethod<JsonValue>('im.recent.get', {});
    return { dialogs: mapRecentDialogs(result) };
  });

  app.get('/api/inbox/dialogs/:chatId/messages', async (request) => {
    const context = await getAuthContext(request);
    const params = chatParamsSchema.parse(request.params);
    const result = await context.b24.callMethod<JsonValue>('imopenlines.session.history.get', {
      CHAT_ID: params.chatId,
    });
    return { messages: mapOpenLineHistory(result) };
  });

  app.post('/api/inbox/dialogs/:dialogId/messages', async (request) => {
    const context = await getAuthContext(request);
    const params = dialogParamsSchema.parse(request.params);
    const body = sendMessageSchema.parse(request.body);
    const result = await context.b24.callMethod<JsonValue>('im.message.add', {
      DIALOG_ID: params.dialogId,
      MESSAGE: body.message,
    });
    return { result };
  });

  app.get('/api/open-lines', async (request) => {
    const context = await getAuthContext(request);
    const result = await context.b24.callMethod<JsonValue>('imopenlines.config.list.get', {});
    return { lines: result };
  });

  app.get('/api/mailbox', async (request) => {
    const context = await getAuthContext(request);
    const mailbox = await prisma.mailbox.findUnique({ where: { portalId: context.portalId } });
    if (!mailbox) {
      return { mailbox: null };
    }
    return {
      mailbox: {
        id: mailbox.id,
        email: mailbox.email,
        imapHost: mailbox.imapHost,
        imapPort: mailbox.imapPort,
        imapUser: mailbox.imapUser,
        smtpHost: mailbox.smtpHost,
        smtpPort: mailbox.smtpPort,
        smtpUser: mailbox.smtpUser,
        useSsl: mailbox.useSsl,
        olLineId: mailbox.olLineId,
        enabled: mailbox.enabled,
        lastError: mailbox.lastError,
        lastPolledAt: mailbox.lastPolledAt,
      },
    };
  });

  app.put('/api/mailbox', async (request) => {
    const config = getConfig();
    const context = await getAuthContext(request);
    const body = mailboxSchema.parse(request.body);
    await setEmailConnectorActive(context.b24, EMAIL_CONNECTOR_ID, body.olLineId, true);
    const imapPassword = await encryptSecret(
      body.imapPassword,
      config.MASTER_ENCRYPTION_KEY_BASE64,
    );
    const smtpPassword = await encryptSecret(
      body.smtpPassword,
      config.MASTER_ENCRYPTION_KEY_BASE64,
    );
    const mailbox = await prisma.mailbox.upsert({
      where: { portalId: context.portalId },
      create: {
        portalId: context.portalId,
        email: body.email,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUser: body.imapUser,
        imapPassword,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPassword,
        useSsl: body.useSsl,
        olConnectorId: EMAIL_CONNECTOR_ID,
        olLineId: body.olLineId,
      },
      update: {
        email: body.email,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUser: body.imapUser,
        imapPassword,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPassword,
        useSsl: body.useSsl,
        olConnectorId: EMAIL_CONNECTOR_ID,
        olLineId: body.olLineId,
        enabled: true,
        lastError: null,
      },
    });
    return { id: mailbox.id };
  });

  app.delete('/api/mailbox', async (request) => {
    const context = await getAuthContext(request);
    const mailbox = await prisma.mailbox.findUnique({ where: { portalId: context.portalId } });
    if (mailbox) {
      await setEmailConnectorActive(context.b24, mailbox.olConnectorId, mailbox.olLineId, false);
      await prisma.mailbox.delete({ where: { id: mailbox.id } });
    }
    return { ok: true };
  });

  app.get('/api/bot', async (request) => {
    const context = await getAuthContext(request);
    const botConfig = await prisma.botConfig.findUnique({ where: { portalId: context.portalId } });
    if (!botConfig) {
      return { bot: null };
    }
    return {
      bot: {
        enabled: botConfig.enabled,
        botB24Id: botConfig.botB24Id,
        systemPrompt: botConfig.systemPrompt,
        faq: botConfig.faq,
        attachedOlLines: botConfig.attachedOlLines,
        handoffAfterMessages: botConfig.handoffAfterMessages,
        worktimeOnly: botConfig.worktimeOnly,
        hasVibecodeApiKey: Boolean(botConfig.vibecodeApiKey),
      },
    };
  });

  app.put('/api/bot', async (request) => {
    const config = getConfig();
    const context = await getAuthContext(request);
    const body = parseBotConfiguration(request.body);
    const encryptedKey = body.vibecodeApiKey
      ? await encryptSecret(body.vibecodeApiKey, config.MASTER_ENCRYPTION_KEY_BASE64)
      : undefined;
    const botConfig = await prisma.botConfig.upsert({
      where: { portalId: context.portalId },
      create: {
        portalId: context.portalId,
        enabled: body.enabled,
        botB24Id: null,
        systemPrompt: body.systemPrompt,
        faq: body.faq as JsonObject[],
        attachedOlLines: body.attachedOlLines,
        handoffAfterMessages: body.handoffAfterMessages,
        worktimeOnly: body.worktimeOnly,
        vibecodeApiKey: encryptedKey ?? null,
      },
      update: {
        enabled: body.enabled,
        systemPrompt: body.systemPrompt,
        faq: body.faq as JsonObject[],
        attachedOlLines: body.attachedOlLines,
        handoffAfterMessages: body.handoffAfterMessages,
        worktimeOnly: body.worktimeOnly,
        ...(encryptedKey ? { vibecodeApiKey: encryptedKey } : {}),
      },
    });
    return { id: botConfig.portalId };
  });

  app.post('/api/bot/test', async (request) => {
    const config = getConfig();
    const body = z
      .object({ apiKey: z.string().optional(), message: z.string().min(1) })
      .parse(request.body);
    const apiKey = body.apiKey ?? config.VIBECODE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'VIBECODE_API_KEY_REQUIRED' };
    }
    const vibe = new VibeCodeClient({
      apiKey,
      baseUrl: config.VIBECODE_BASE_URL,
      defaultModel: config.AI_MODEL,
    });
    const text = await vibe.completeChat({
      model: config.AI_MODEL,
      messages: [{ role: 'user', content: body.message }],
      maxTokens: 200,
      temperature: 0,
    });
    return { ok: true, text };
  });
}
