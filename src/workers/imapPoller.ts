import type { PrismaClient } from '@prisma/client';
import { ImapFlow } from 'imapflow';
import type { AppConfig } from '../config.js';
import { decryptSecret } from '../crypto.js';
import { parseIncomingEmail } from '../domain/email/EmailParser.js';
import {
  buildInboundConnectorMessage,
  parseConnectorSendResult,
  shouldProcessUid,
} from '../domain/connector/MessageBridge.js';
import { B24RestClient } from '../vendor/b24.js';
import { SupabaseAttachmentStorage } from '../vendor/supabaseStorage.js';
import { logger } from '../logger.js';
import type { JsonObject } from '../types.js';

export class ImapPoller {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.pollAll();
    }, 60_000);
    void this.pollAll();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollAll(): Promise<void> {
    const mailboxes = await this.prisma.mailbox.findMany({
      where: { enabled: true },
      include: { portal: true },
    });
    for (const mailbox of mailboxes) {
      try {
        await this.pollMailbox(mailbox.id);
      } catch (error) {
        logger.warn({ mailboxId: mailbox.id, error }, 'mailbox polling failed');
      }
    }
  }

  async pollMailbox(mailboxId: string): Promise<void> {
    const mailbox = await this.prisma.mailbox.findUniqueOrThrow({
      where: { id: mailboxId },
      include: { portal: true },
    });
    const imapPassword = await decryptSecret(
      mailbox.imapPassword,
      this.config.MASTER_ENCRYPTION_KEY_BASE64,
    );
    const accessToken = await decryptSecret(
      mailbox.portal.accessToken,
      this.config.MASTER_ENCRYPTION_KEY_BASE64,
    );
    const b24 = new B24RestClient({ domain: mailbox.portal.domain, accessToken });
    const client = new ImapFlow({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.useSsl,
      auth: { user: mailbox.imapUser, pass: imapPassword },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let maxUid = mailbox.lastSeenUid ?? 0;
    try {
      const startUid = Math.max(1, (mailbox.lastSeenUid ?? 0) + 1);
      for await (const message of client.fetch(`${startUid}:*`, { uid: true, source: true })) {
        const uid = message.uid ?? 0;
        if (!message.source || !shouldProcessUid(mailbox.lastSeenUid, uid)) {
          continue;
        }
        const email = await parseIncomingEmail(Buffer.from(message.source));
        const publishedFiles = await this.publishAttachments(
          mailbox.id,
          email.messageId,
          email.attachments,
        );
        const skippedFiles = email.attachments
          .filter(
            (attachment) =>
              attachment.size > 100 * 1024 * 1024 ||
              !publishedFiles.some((file) => file.name === attachment.filename),
          )
          .map(
            (attachment) =>
              `[Файл "${attachment.filename}" пропущен: нет публичного storage или превышен лимит]`,
          );
        const emailForConnector = {
          ...email,
          text: [email.text, ...skippedFiles].filter(Boolean).join('\n\n'),
        };
        const connectorMessage = buildInboundConnectorMessage({
          email: emailForConnector,
          mailboxEmail: mailbox.email,
          publicFiles: publishedFiles,
        });
        const result = await b24.callMethod<JsonObject>('imconnector.send.messages', {
          CONNECTOR: mailbox.olConnectorId,
          LINE: mailbox.olLineId,
          MESSAGES: [connectorMessage as unknown as JsonObject],
        });
        const parsed = parseConnectorSendResult(result);
        await this.prisma.emailMessageMap.create({
          data: {
            mailboxId: mailbox.id,
            emailMessageId: email.messageId,
            emailInReplyTo: email.inReplyTo,
            emailSubject: email.subject,
            clientEmail: email.from.address,
            olChatId: parsed.chatId,
            olMessageId: parsed.messageId,
            direction: 'inbound',
            status: 'sent',
            sentAt: new Date(),
          },
        });
        maxUid = Math.max(maxUid, uid);
      }
      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { lastSeenUid: maxUid, lastPolledAt: new Date(), lastError: null },
      });
    } catch (error) {
      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { lastError: error instanceof Error ? error.message : 'IMAP polling failed' },
      });
      throw error;
    } finally {
      lock.release();
      await client.logout();
    }
  }

  private async publishAttachments(
    mailboxId: string,
    messageId: string,
    attachments: Array<{ filename: string; contentType: string; size: number; content: Buffer }>,
  ): Promise<Array<{ name: string; url: string }>> {
    if (!this.config.SUPABASE_URL || !this.config.SUPABASE_STORAGE_SERVICE_KEY) {
      return [];
    }
    const storage = new SupabaseAttachmentStorage({
      supabaseUrl: this.config.SUPABASE_URL,
      bucket: this.config.SUPABASE_STORAGE_BUCKET,
      serviceKey: this.config.SUPABASE_STORAGE_SERVICE_KEY,
    });
    const publishable = attachments.filter((attachment) => attachment.size <= 100 * 1024 * 1024);
    const published: Array<{ name: string; url: string }> = [];
    for (const attachment of publishable) {
      published.push(
        await storage.publish({
          mailboxId,
          messageId,
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: attachment.content,
        }),
      );
    }
    return published;
  }
}
