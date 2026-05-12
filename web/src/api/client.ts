export interface Dialog {
  id: string;
  chatId: number;
  title: string;
  date: string;
  lastMessage: string;
  type: string;
}

export interface Message {
  id: string;
  chatId: number;
  senderId: string;
  text: string;
  date: string;
  files: Array<{ id: number; name: string; urlDownload?: string }>;
}

export interface MailboxState {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  useSsl: boolean;
  olLineId: number;
  enabled: boolean;
  lastError?: string | null;
  lastPolledAt?: string | null;
}

export interface BotState {
  enabled: boolean;
  botB24Id?: number | null;
  systemPrompt: string;
  faq: Array<{ q: string; a: string }>;
  attachedOlLines: number[];
  handoffAfterMessages: number;
  worktimeOnly: boolean;
  hasVibecodeApiKey: boolean;
}

export interface OpenLine {
  ID?: string;
  id?: string;
  LINE_NAME?: string;
  name?: string;
}

export class ApiClient {
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
  }

  async createSession(input: {
    memberId: string;
    domain: string;
    authId?: string;
  }): Promise<string> {
    const response = await this.request<{ token: string }>('/api/session', {
      method: 'POST',
      body: JSON.stringify(input),
      auth: false,
    });
    this.token = response.token;
    return response.token;
  }

  async dialogs(): Promise<Dialog[]> {
    const response = await this.request<{ dialogs: Dialog[] }>('/api/inbox/dialogs');
    return response.dialogs;
  }

  async messages(chatId: number): Promise<Message[]> {
    const response = await this.request<{ messages: Message[] }>(
      `/api/inbox/dialogs/${chatId}/messages`,
    );
    return response.messages;
  }

  async send(dialogId: string, message: string): Promise<void> {
    await this.request(`/api/inbox/dialogs/${encodeURIComponent(dialogId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async openLines(): Promise<OpenLine[]> {
    const response = await this.request<{ lines: OpenLine[] }>('/api/open-lines');
    return Array.isArray(response.lines) ? response.lines : [];
  }

  async mailbox(): Promise<MailboxState | null> {
    const response = await this.request<{ mailbox: MailboxState | null }>('/api/mailbox');
    return response.mailbox;
  }

  async saveMailbox(payload: Record<string, unknown>): Promise<void> {
    await this.request('/api/mailbox', { method: 'PUT', body: JSON.stringify(payload) });
  }

  async deleteMailbox(): Promise<void> {
    await this.request('/api/mailbox', { method: 'DELETE' });
  }

  async bot(): Promise<BotState | null> {
    const response = await this.request<{ bot: BotState | null }>('/api/bot');
    return response.bot;
  }

  async saveBot(payload: Record<string, unknown>): Promise<void> {
    await this.request('/api/bot', { method: 'PUT', body: JSON.stringify(payload) });
  }

  private async request<T = unknown>(
    url: string,
    options: RequestInit & { auth?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (options.auth !== false && this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

export const api = new ApiClient();
