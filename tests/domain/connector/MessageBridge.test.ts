import { describe, expect, it } from 'vitest';
import {
  buildInboundConnectorMessage,
  externalChatId,
  externalUserId,
  parseConnectorSendResult,
  shouldProcessUid,
} from '../../../src/domain/connector/MessageBridge.js';
import type { ParsedIncomingEmail } from '../../../src/domain/email/EmailParser.js';

const email: ParsedIncomingEmail = {
  messageId: '<m1@example.com>',
  subject: 'Invoice',
  from: { name: 'Ivan', address: 'Ivan@Example.com' },
  text: 'Please check invoice',
  attachments: [],
};

describe('MessageBridge', () => {
  it('builds stable external user and chat ids', () => {
    expect(externalUserId('Ivan@Example.com')).toBe('email:ivan@example.com');
    expect(externalChatId('Support@Example.com', 'Ivan@Example.com')).toBe(
      'support@example.com::ivan@example.com',
    );
  });

  it('builds imconnector.send.messages payload', () => {
    const payload = buildInboundConnectorMessage({ email, mailboxEmail: 'support@example.com' });
    expect(payload.user.email).toBe('Ivan@Example.com');
    expect(payload.message.id).toBe('<m1@example.com>');
    expect(payload.message.text).toContain('Тема: Invoice');
    expect(payload.chat.id).toBe('support@example.com::ivan@example.com');
  });

  it('parses connector send response session data', () => {
    const parsed = parseConnectorSendResult({
      DATA: {
        RESULT: [
          {
            message: { id: '85851' },
            session: { ID: '321', CHAT_ID: '1767' },
          },
        ],
      },
    });

    expect(parsed.chatId).toBe(1767n);
    expect(parsed.messageId).toBe(85851n);
  });

  it('rejects already processed uid values', () => {
    expect(shouldProcessUid(10, 11)).toBe(true);
    expect(shouldProcessUid(10, 10)).toBe(false);
    expect(shouldProcessUid(undefined, 1)).toBe(true);
  });
});
