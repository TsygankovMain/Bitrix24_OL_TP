import type {
  AttachmentStoragePort,
  AttachmentToPublish,
  PublishedAttachment,
} from '../ports/AttachmentStoragePort.js';

export interface SupabaseStorageOptions {
  supabaseUrl: string;
  bucket: string;
  serviceKey: string;
}

function safePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export class SupabaseAttachmentStorage implements AttachmentStoragePort {
  constructor(private readonly options: SupabaseStorageOptions) {}

  async publish(input: AttachmentToPublish): Promise<PublishedAttachment> {
    const bodyBytes = new Uint8Array(input.content.length);
    bodyBytes.set(input.content);
    const objectPath = [
      safePathPart(input.mailboxId),
      safePathPart(input.messageId),
      `${Date.now()}-${safePathPart(input.filename)}`,
    ].join('/');

    const uploadUrl = `${this.options.supabaseUrl}/storage/v1/object/${this.options.bucket}/${objectPath}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.serviceKey}`,
        apikey: this.options.serviceKey,
        'Content-Type': input.contentType,
        'x-upsert': 'true',
      },
      body: new Blob([bodyBytes], { type: input.contentType }),
    });

    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed: ${response.status}`);
    }

    return {
      name: input.filename,
      url: `${this.options.supabaseUrl}/storage/v1/object/public/${this.options.bucket}/${objectPath}`,
    };
  }
}
