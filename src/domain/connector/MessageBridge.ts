import type { ConnectorInboundMessage } from '../../ports/B24Port.js';
import type { ParsedIncomingEmail } from '../email/EmailParser.js';

export interface BuildInboundConnectorMessageInput {
  email: ParsedIncomingEmail;
  mailboxEmail: string;
  chatId?: string;
  publicFiles?: Array<{ url: string; name: string }>;
}

export interface ConnectorSendResult {
  chatId: bigint;
  messageId?: bigint;
}

export function externalUserId(emailAddress: string): string {
  return `email:${emailAddress.trim().toLowerCase()}`;
}

export function externalChatId(mailboxEmail: string, clientEmail: string): string {
  return `${mailboxEmail.trim().toLowerCase()}::${clientEmail.trim().toLowerCase()}`;
}

export function buildInboundConnectorMessage(
  input: BuildInboundConnectorMessageInput,
): ConnectorInboundMessage {
  const clientEmail = input.email.from.address;
  const text = [`Тема: ${input.email.subject}`, '', input.email.text].filter(Boolean).join('\n');

  return {
    user: {
      id: externalUserId(clientEmail),
      name: input.email.from.name ?? clientEmail,
      email: clientEmail,
      skip_phone_validate: 'Y',
    },
    message: {
      id: input.email.messageId,
      date: Math.floor(Date.now() / 1000),
      text,
      files: input.publicFiles,
    },
    chat: {
      id: input.chatId ?? externalChatId(input.mailboxEmail, clientEmail),
      name: clientEmail,
    },
  };
}

export function parseConnectorSendResult(response: unknown): ConnectorSendResult {
  const root = typeof response === 'object' && response !== null ? response : {};
  const data =
    'DATA' in root && typeof root.DATA === 'object' && root.DATA !== null ? root.DATA : root;
  const resultList =
    'RESULT' in data && Array.isArray(data.RESULT)
      ? (data.RESULT as Array<Record<string, unknown>>)
      : [];
  const first = resultList[0];
  const session = first?.session;
  if (typeof session !== 'object' || session === null) {
    throw new Error('Bitrix24 connector response does not include session data');
  }
  const chatId = Number((session as Record<string, unknown>).CHAT_ID);
  const messageId = Number(first?.message && (first.message as Record<string, unknown>).id);
  if (!Number.isFinite(chatId)) {
    throw new Error('Bitrix24 connector response does not include CHAT_ID');
  }
  return {
    chatId: BigInt(chatId),
    messageId: Number.isFinite(messageId) ? BigInt(messageId) : undefined,
  };
}

export function shouldProcessUid(lastSeenUid: number | null | undefined, uid: number): boolean {
  return lastSeenUid === null || lastSeenUid === undefined || uid > lastSeenUid;
}
