import type { JsonObject, JsonValue } from '../types.js';

export interface B24CallOptions {
  auth?: string;
  signal?: AbortSignal;
}

export interface B24Port {
  callMethod<T extends JsonValue = JsonValue>(
    method: string,
    params?: JsonObject,
    options?: B24CallOptions,
  ): Promise<T>;
}

export interface OpenLineDialog {
  id: string;
  chatId: number;
  title: string;
  date: string;
  lastMessage: string;
  type: string;
}

export interface OpenLineMessage {
  id: string;
  chatId: number;
  senderId: string;
  text: string;
  date: string;
  files: Array<{ id: number; name: string; urlDownload?: string }>;
}

export interface ConnectorInboundMessage {
  user: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
    skip_phone_validate?: 'Y';
  };
  message: {
    id: string;
    date: number;
    text?: string;
    files?: Array<{ url: string; name: string }>;
  };
  chat: {
    id: string;
    name: string;
    url?: string;
  };
}
