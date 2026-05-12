import { describe, expect, it } from 'vitest';
import {
  htmlToPlain,
  parseIncomingEmail,
  trimQuotedText,
} from '../../../src/domain/email/EmailParser.js';

describe('EmailParser', () => {
  it('converts simple HTML to readable plain text', () => {
    expect(htmlToPlain('<p>Hello&nbsp;<b>world</b></p><p>2 &amp; 2</p>')).toBe(
      'Hello world\n2 & 2',
    );
  });

  it('trims quoted replies and quote-prefixed lines', () => {
    const text = [
      'Новый ответ',
      '',
      '> старая цитата',
      'On Tue, May 12, 2026 at 10:00 someone wrote:',
      'old message',
    ].join('\n');
    expect(trimQuotedText(text)).toBe('Новый ответ');
  });

  it('parses incoming email fields and attachments', async () => {
    const raw = [
      'From: Ivan <ivan@example.com>',
      'To: support@example.com',
      'Subject: Test subject',
      'Message-ID: <m1@example.com>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Здравствуйте',
    ].join('\r\n');

    const parsed = await parseIncomingEmail(raw);

    expect(parsed.messageId).toBe('<m1@example.com>');
    expect(parsed.subject).toBe('Test subject');
    expect(parsed.from).toEqual({ name: 'Ivan', address: 'ivan@example.com' });
    expect(parsed.text).toBe('Здравствуйте');
  });
});
