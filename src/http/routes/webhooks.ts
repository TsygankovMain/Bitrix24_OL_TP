import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../../config.js';
import { decryptSecret } from '../../crypto.js';
import { prisma } from '../../vendor/supabase.js';
import { SmtpSender } from '../../workers/smtpSender.js';
import type { EmailMessageMapRecord, MailboxRecord } from '../../vendor/supabase.js';

const connectorWebhookSchema = z.object({
  event: z.string().optional(),
  data: z
    .object({
      PARAMS: z
        .object({
          CHAT_ID: z.union([z.string(), z.number()]).optional(),
          MESSAGE: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export function webhookRoutes(app: FastifyInstance): void {
  app.post('/webhooks/b24', async (request, reply) => {
    const config = getConfig();
    const parsed = connectorWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_WEBHOOK' });
    }

    const chatId = Number(parsed.data.data?.PARAMS?.CHAT_ID);
    const text = parsed.data.data?.PARAMS?.MESSAGE ?? '';
    if (!Number.isFinite(chatId) || !text.trim()) {
      return { ok: true, ignored: true };
    }

    const messageMap = (await prisma.emailMessageMap.findFirst({
      where: { olChatId: BigInt(chatId), direction: 'inbound' },
      orderBy: { createdAt: 'desc' },
      include: { mailbox: true },
    })) as (EmailMessageMapRecord & { mailbox: MailboxRecord }) | null;
    if (!messageMap?.clientEmail) {
      return { ok: true, ignored: true };
    }

    const smtpPassword = await decryptSecret(
      messageMap.mailbox.smtpPassword,
      config.MASTER_ENCRYPTION_KEY_BASE64,
    );
    const sender = new SmtpSender(prisma);
    await sender.enqueue({
      mailboxId: messageMap.mailboxId,
      smtp: {
        host: messageMap.mailbox.smtpHost,
        port: messageMap.mailbox.smtpPort,
        secure: messageMap.mailbox.useSsl,
        user: messageMap.mailbox.smtpUser,
        pass: smtpPassword,
      },
      from: messageMap.mailbox.email,
      to: messageMap.clientEmail,
      subject: messageMap.emailSubject?.startsWith('Re:')
        ? messageMap.emailSubject
        : `Re: ${messageMap.emailSubject ?? 'Сообщение от оператора'}`,
      text,
      inReplyTo: messageMap.emailMessageId,
      olChatId: BigInt(chatId),
    });

    return reply.send({ ok: true });
  });

  app.post('/webhooks/health', () => ({ status: 'ok' }));
}
