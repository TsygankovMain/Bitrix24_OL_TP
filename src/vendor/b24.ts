import type { B24CallOptions, B24Port, OpenLineDialog, OpenLineMessage } from '../ports/B24Port.js';
import type { JsonObject, JsonValue } from '../types.js';
import { asString, isJsonObject } from '../types.js';

export interface B24RestClientOptions {
  domain: string;
  accessToken: string | (() => Promise<string>);
  maxRetries?: number;
}

export class B24Error extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export class B24RestClient implements B24Port {
  private readonly domain: string;
  private readonly maxRetries: number;

  constructor(private readonly options: B24RestClientOptions) {
    this.domain = normalizeDomain(options.domain);
    this.maxRetries = options.maxRetries ?? 3;
  }

  async callMethod<T extends JsonValue = JsonValue>(
    method: string,
    params: JsonObject = {},
    options: B24CallOptions = {},
  ): Promise<T> {
    const auth =
      options.auth ??
      (typeof this.options.accessToken === 'function'
        ? await this.options.accessToken()
        : this.options.accessToken);
    const body = JSON.stringify({ ...params, auth });
    const url = `https://${this.domain}/rest/${method}.json`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: options.signal,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok || (isJsonObject(payload) && typeof payload.error === 'string')) {
        const code = isJsonObject(payload)
          ? asString(payload.error, `HTTP_${response.status}`)
          : `HTTP_${response.status}`;
        const message = isJsonObject(payload)
          ? asString(payload.error_description, response.statusText)
          : response.statusText;
        if (
          attempt < this.maxRetries &&
          (response.status === 429 || code === 'QUERY_LIMIT_EXCEEDED' || code === 'OVERLOAD_LIMIT')
        ) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new B24Error(message, code, response.status);
      }

      if (!isJsonObject(payload) || !('result' in payload)) {
        throw new B24Error(
          'Unexpected Bitrix24 response shape',
          'UNEXPECTED_RESPONSE',
          response.status,
        );
      }

      return payload.result as T;
    }

    throw new B24Error('Bitrix24 retry loop exhausted', 'RETRY_EXHAUSTED', 429);
  }
}

export function mapRecentDialogs(result: JsonValue): OpenLineDialog[] {
  if (!Array.isArray(result)) {
    return [];
  }

  return result
    .filter(isJsonObject)
    .map((item) => {
      const itemId = asString(item.id);
      const chat = isJsonObject(item.chat) ? item.chat : {};
      const message = isJsonObject(item.message) ? item.message : {};
      return {
        id: itemId,
        chatId: Number(asString(chat.id, itemId.replace(/^chat/, ''))),
        title: asString(chat.name, asString(item.title, 'Диалог')),
        date: asString(message.date, asString(item.date_update)),
        lastMessage: asString(message.text, ''),
        type: asString(chat.type, asString(item.type)),
      };
    })
    .filter((dialog) => dialog.type === 'lines' && Number.isFinite(dialog.chatId));
}

export function mapOpenLineHistory(result: JsonValue): OpenLineMessage[] {
  if (!isJsonObject(result) || !isJsonObject(result.message)) {
    return [];
  }

  return Object.values(result.message)
    .filter(isJsonObject)
    .map((message) => {
      const params = isJsonObject(message.params) ? message.params : {};
      const fileIds = Array.isArray(params.fileId) ? params.fileId : [];
      const files = fileIds.map((fileId) => ({
        id: Number(fileId),
        name: `file-${String(fileId)}`,
      }));
      return {
        id: asString(message.id),
        chatId: Number(asString(message.chatid)),
        senderId: asString(message.senderid),
        text: asString(message.textlegacy, asString(message.text)),
        date: asString(message.date),
        files,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
