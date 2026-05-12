export interface HandoffDecisionInput {
  assistantText: string;
  conversationMessages: number;
  handoffAfterMessages: number;
}

export interface HandoffDecision {
  handoff: boolean;
  text: string;
  reason?: 'marker' | 'message_limit';
}

export function decideHandoff(input: HandoffDecisionInput): HandoffDecision {
  if (input.assistantText.includes('{{HANDOFF}}')) {
    return {
      handoff: true,
      text: input.assistantText.replace('{{HANDOFF}}', '').trim(),
      reason: 'marker',
    };
  }

  if (input.conversationMessages >= input.handoffAfterMessages) {
    return {
      handoff: true,
      text: input.assistantText.trim(),
      reason: 'message_limit',
    };
  }

  return {
    handoff: false,
    text: input.assistantText.trim(),
  };
}
