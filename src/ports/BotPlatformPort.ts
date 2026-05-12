export interface RegisterBotRequest {
  code: string;
  name: string;
  type: 'bot' | 'personal' | 'supervisor' | 'openline';
  workPosition?: string;
}

export interface BotEvent {
  eventId: string;
  type: string;
  date: string;
  data: {
    chat?: { dialogId?: string };
    message?: { id?: number; text?: string; authorId?: number; isSystem?: boolean };
    user?: { id?: number; firstName?: string; lastName?: string; name?: string };
  };
}

export interface BotPlatformPort {
  registerBot(request: RegisterBotRequest): Promise<{ botId: number }>;
  pollEvents(botId: number, limit?: number): Promise<BotEvent[]>;
  sendMessage(botId: number, dialogId: string, message: string): Promise<{ id: number }>;
}
