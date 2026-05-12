import { describe, expect, it } from 'vitest';
import type { AIPort, CompleteChatRequest } from '../../../src/ports/AIPort.js';
import { BotResponder, findFaqAnswer } from '../../../src/domain/bot/BotResponder.js';
import type { BotConfiguration } from '../../../src/domain/bot/BotConfiguration.js';

class FakeAI implements AIPort {
  requests: CompleteChatRequest[] = [];

  constructor(private readonly response: string) {}

  completeChat(request: CompleteChatRequest): Promise<string> {
    this.requests.push(request);
    return Promise.resolve(this.response);
  }
}

const config: BotConfiguration = {
  enabled: true,
  systemPrompt: 'Отвечай кратко',
  faq: [{ q: 'Как оплатить счет?', a: 'Оплатить можно по ссылке в письме.' }],
  attachedOlLines: [1],
  handoffAfterMessages: 3,
  worktimeOnly: false,
};

describe('BotResponder', () => {
  it('answers exact FAQ without using AI', async () => {
    const ai = new FakeAI('unused');
    const responder = new BotResponder(ai, 'bitrix/bitrixgpt-5');

    const result = await responder.respond({
      userText: 'Как оплатить счет?',
      config,
      conversationMessages: 1,
    });

    expect(result).toMatchObject({ source: 'faq', handoff: false });
    expect(result.text).toBe('Оплатить можно по ссылке в письме.');
    expect(ai.requests).toHaveLength(0);
  });

  it('falls back to AI and respects handoff marker', async () => {
    const ai = new FakeAI('{{HANDOFF}} Нужно подключить оператора.');
    const responder = new BotResponder(ai, 'bitrix/bitrixgpt-5');

    const result = await responder.respond({
      userText: 'Сделайте скидку 90%',
      config,
      conversationMessages: 1,
    });

    expect(result).toMatchObject({ source: 'ai', handoff: true, reason: 'marker' });
    expect(result.text).toBe('Нужно подключить оператора.');
  });

  it('finds close FAQ wording', () => {
    expect(findFaqAnswer('как оплатить счёт', config.faq)?.answer).toBe(
      'Оплатить можно по ссылке в письме.',
    );
  });
});
