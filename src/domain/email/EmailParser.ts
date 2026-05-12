import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';

export interface ParsedIncomingEmail {
  messageId: string;
  inReplyTo?: string;
  subject: string;
  from: {
    name?: string;
    address: string;
  };
  text: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

const QUOTE_PATTERNS = [
  /^\s*On .+ wrote:\s*$/im,
  /^\s*.+ <.+> написал\(а\):\s*$/im,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^\s*От:\s.+$/im,
];

export function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function trimQuotedText(input: string, maxLength = 100_000): string {
  const withoutQuoteLines = input
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n');

  const firstQuoteIndex = QUOTE_PATTERNS.reduce<number | null>((earliest, pattern) => {
    const match = pattern.exec(withoutQuoteLines);
    if (!match || match.index < 0) {
      return earliest;
    }
    return earliest === null ? match.index : Math.min(earliest, match.index);
  }, null);

  const trimmed = (
    firstQuoteIndex === null ? withoutQuoteLines : withoutQuoteLines.slice(0, firstQuoteIndex)
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength)}\n\n[Письмо обрезано до 100 КБ]`
    : trimmed;
}

export function firstAddress(addresses: AddressObject | AddressObject[] | undefined): {
  name?: string;
  address: string;
} {
  const addressObject = Array.isArray(addresses) ? addresses[0] : addresses;
  const value = addressObject?.value[0];
  if (!value?.address) {
    throw new Error('Email does not contain a valid From address');
  }
  return {
    name: value.name || undefined,
    address: value.address,
  };
}

export async function parseIncomingEmail(raw: Buffer | string): Promise<ParsedIncomingEmail> {
  const parsed: ParsedMail = await simpleParser(raw);
  const messageId = parsed.messageId ?? `missing-message-id-${Date.now()}`;
  const plain = parsed.text?.trim() || (parsed.html ? htmlToPlain(String(parsed.html)) : '');

  return {
    messageId,
    inReplyTo: parsed.inReplyTo ?? undefined,
    subject: parsed.subject ?? '(без темы)',
    from: firstAddress(parsed.from),
    text: trimQuotedText(plain),
    attachments: parsed.attachments.map((attachment) => ({
      filename: attachment.filename ?? 'attachment',
      contentType: attachment.contentType,
      size: attachment.size,
      content: attachment.content,
    })),
  };
}
