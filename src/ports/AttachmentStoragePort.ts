export interface AttachmentToPublish {
  mailboxId: string;
  messageId: string;
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface PublishedAttachment {
  name: string;
  url: string;
}

export interface AttachmentStoragePort {
  publish(input: AttachmentToPublish): Promise<PublishedAttachment>;
}
