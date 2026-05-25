import type { AppStore } from '../vendor/supabase.js';
import nodemailer from 'nodemailer';
import PQueue from 'p-queue';

export interface SmtpEnvelope {
  mailboxId: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  olChatId: bigint;
}

export class SmtpSender {
  private readonly queue = new PQueue({ concurrency: 2 });

  constructor(private readonly prisma: AppStore) {}

  async enqueue(envelope: SmtpEnvelope): Promise<void> {
    await this.queue.add(async () => {
      await this.send(envelope);
    });
  }

  private async send(envelope: SmtpEnvelope): Promise<void> {
    const transport = nodemailer.createTransport({
      host: envelope.smtp.host,
      port: envelope.smtp.port,
      secure: envelope.smtp.secure,
      auth: {
        user: envelope.smtp.user,
        pass: envelope.smtp.pass,
      },
    });

    try {
      const result = await transport.sendMail({
        from: envelope.from,
        to: envelope.to,
        subject: envelope.subject,
        text: envelope.text,
        inReplyTo: envelope.inReplyTo,
        references: envelope.inReplyTo,
      });

      await this.prisma.emailMessageMap.create({
        data: {
          mailboxId: envelope.mailboxId,
          emailMessageId: result.messageId,
          emailInReplyTo: envelope.inReplyTo,
          emailSubject: envelope.subject,
          clientEmail: envelope.to,
          olChatId: envelope.olChatId,
          direction: 'outbound',
          status: 'sent',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.emailMessageMap.create({
        data: {
          mailboxId: envelope.mailboxId,
          emailMessageId: `failed-${Date.now()}`,
          emailInReplyTo: envelope.inReplyTo,
          emailSubject: envelope.subject,
          clientEmail: envelope.to,
          olChatId: envelope.olChatId,
          direction: 'outbound',
          status: 'failed',
          error: error instanceof Error ? error.message : 'SMTP send failed',
        },
      });
      throw error;
    }
  }
}
