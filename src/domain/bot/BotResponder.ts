import type { AIPort } from '../../ports/AIPort.js';
import type { BotConfiguration, FaqPair } from './BotConfiguration.js';
import { decideHandoff, type HandoffDecision } from './HandoffPolicy.js';

export interface BotResponderInput {
  userText: string;
  config: BotConfiguration;
  conversationMessages: number;
}

export interface BotResponderOutput extends HandoffDecision {
  source: 'faq' | 'ai' | 'disabled';
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      current[j + 1] = Math.min(
        (current[j] ?? 0) + 1,
        (previous[j + 1] ?? 0) + 1,
        (previous[j] ?? 0) + (a[i] === b[j] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length] ?? 0;
}

function similarity(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

export function findFaqAnswer(
  question: string,
  faq: FaqPair[],
): { answer: string; score: number } | null {
  const normalizedQuestion = normalize(question);
  const candidates = faq.map((pair) => {
    const score = similarity(normalizedQuestion, normalize(pair.q));
    return { answer: pair.a, score };
  });
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 0.86 ? best : null;
}

export class BotResponder {
  constructor(
    private readonly ai: AIPort,
    private readonly botModel: string,
  ) {}

  async respond(input: BotResponderInput): Promise<BotResponderOutput> {
    if (!input.config.enabled) {
      return { handoff: true, text: '', source: 'disabled', reason: 'marker' };
    }

    const faqAnswer = findFaqAnswer(input.userText, input.config.faq);
    if (faqAnswer) {
      return {
        ...decideHandoff({
          assistantText: faqAnswer.answer,
          conversationMessages: input.conversationMessages,
          handoffAfterMessages: input.config.handoffAfterMessages,
        }),
        source: 'faq',
      };
    }

    const aiText = await this.ai.completeChat({
      model: this.botModel,
      temperature: 0.1,
      maxTokens: 800,
      messages: [
        {
          role: 'system',
          content: [
            input.config.systemPrompt,
            'Отвечай только если уверен. Если вопрос не покрыт FAQ или контекстом, верни {{HANDOFF}}.',
            `FAQ:\n${input.config.faq.map((item) => `Q: ${item.q}\nA: ${item.a}`).join('\n\n')}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
        { role: 'user', content: input.userText },
      ],
    });

    return {
      ...decideHandoff({
        assistantText: aiText,
        conversationMessages: input.conversationMessages,
        handoffAfterMessages: input.config.handoffAfterMessages,
      }),
      source: 'ai',
    };
  }
}
