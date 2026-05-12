import type { AIPort, CompleteChatRequest } from '../ports/AIPort.js';
import type { BotEvent, BotPlatformPort, RegisterBotRequest } from '../ports/BotPlatformPort.js';
import { isJsonObject } from '../types.js';

export interface VibeCodeClientOptions {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

export class VibeCodeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class VibeCodeClient implements AIPort, BotPlatformPort {
  constructor(private readonly options: VibeCodeClientOptions) {}

  async completeChat(request: CompleteChatRequest): Promise<string> {
    const response = await fetch(`${this.options.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model ?? this.options.defaultModel,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1000,
      }),
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new VibeCodeError(`AI Router request failed with ${response.status}`, response.status);
    }
    if (!isJsonObject(payload) || !Array.isArray(payload.choices)) {
      throw new VibeCodeError('Unexpected AI Router response shape', response.status);
    }
    const first = payload.choices[0];
    if (
      !isJsonObject(first) ||
      !isJsonObject(first.message) ||
      typeof first.message.content !== 'string'
    ) {
      throw new VibeCodeError(
        'AI Router response does not include message content',
        response.status,
      );
    }
    return first.message.content;
  }

  async registerBot(request: RegisterBotRequest): Promise<{ botId: number }> {
    const payload = await this.request('/v1/bots', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    const data = isJsonObject(payload.data) ? payload.data : payload;
    const botId = Number(data.botId ?? (isJsonObject(data.bot) ? data.bot.id : undefined));
    if (!Number.isFinite(botId)) {
      throw new VibeCodeError('Bot registration response does not include botId', 502);
    }
    return { botId };
  }

  async pollEvents(botId: number, limit = 50): Promise<BotEvent[]> {
    const payload = await this.request(`/v1/bots/${botId}/events?limit=${limit}`, {
      method: 'GET',
    });
    const data = isJsonObject(payload.data) ? payload.data : payload;
    const events = Array.isArray(data.events) ? data.events : [];
    return events.filter(isBotEvent);
  }

  async sendMessage(botId: number, dialogId: string, message: string): Promise<{ id: number }> {
    const payload = await this.request(`/v1/bots/${botId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ dialogId, fields: { message } }),
    });
    const data = isJsonObject(payload.data) ? payload.data : payload;
    const id = Number(data.id);
    if (!Number.isFinite(id)) {
      throw new VibeCodeError('Bot message response does not include id', 502);
    }
    return { id };
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: {
        'X-Api-Key': this.options.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init.headers,
      },
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new VibeCodeError(`VibeCode request failed with ${response.status}`, response.status);
    }
    if (!isJsonObject(payload)) {
      throw new VibeCodeError('Unexpected VibeCode response shape', response.status);
    }
    return payload;
  }
}

function isBotEvent(value: unknown): value is BotEvent {
  return (
    isJsonObject(value) &&
    typeof value.eventId === 'string' &&
    typeof value.type === 'string' &&
    typeof value.date === 'string' &&
    isJsonObject(value.data)
  );
}
