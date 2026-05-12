import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const email = requiredEnv('TEST_EMAIL');
const imapPass = requiredEnv('IMAP_PASS');
const smtpPass = requiredEnv('SMTP_PASS');
const imapHost = process.env.IMAP_HOST ?? 'imap.yandex.ru';
const imapPort = Number(process.env.IMAP_PORT ?? 993);
const smtpHost = process.env.SMTP_HOST ?? 'smtp.yandex.ru';
const smtpPort = Number(process.env.SMTP_PORT ?? 465);

async function testImap(): Promise<void> {
  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user: email, pass: imapPass },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const mailboxInfo = client.mailbox as { exists?: number } | false;
    console.log('IMAP OK', { exists: mailboxInfo ? (mailboxInfo.exists ?? 0) : 0 });
  } finally {
    lock.release();
    await client.logout();
  }
}

async function testSmtp(): Promise<void> {
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: email, pass: smtpPass },
  });
  await transport.verify();
  console.log('SMTP OK');
}

await Promise.all([testImap(), testSmtp()]);
