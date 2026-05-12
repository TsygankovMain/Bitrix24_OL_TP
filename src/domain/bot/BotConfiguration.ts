import { z } from 'zod';

export const faqPairSchema = z.object({
  q: z.string().trim().min(1).max(500),
  a: z.string().trim().min(1).max(5000),
});

export const botConfigSchema = z.object({
  enabled: z.boolean().default(false),
  systemPrompt: z.string().max(50_000).default(''),
  faq: z.array(faqPairSchema).max(50).default([]),
  attachedOlLines: z.array(z.number().int().positive()).default([]),
  handoffAfterMessages: z.number().int().min(1).max(20).default(3),
  worktimeOnly: z.boolean().default(false),
  vibecodeApiKey: z.string().optional(),
});

export type FaqPair = z.infer<typeof faqPairSchema>;
export type BotConfiguration = z.infer<typeof botConfigSchema>;

export function parseBotConfiguration(input: unknown): BotConfiguration {
  const parsed = botConfigSchema.parse(input);
  const size = Buffer.byteLength(
    `${parsed.systemPrompt}\n${parsed.faq.map((item) => `${item.q}\n${item.a}`).join('\n')}`,
    'utf8',
  );
  if (size > 200_000) {
    throw new Error('Prompt and FAQ are limited to 200 KB');
  }
  return parsed;
}
