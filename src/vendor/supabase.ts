import { randomUUID } from 'node:crypto';
import type { JsonObject } from '../types.js';

export type Direction = 'inbound' | 'outbound';
export type SendStatus = 'pending' | 'sent' | 'failed';

export interface PortalRecord {
  id: string;
  b24MemberId: string;
  domain: string;
  accessToken: Buffer;
  refreshToken: Buffer;
  tokenExpiresAt: Date;
  applicationToken: Buffer | null;
  installedAt: Date;
  uninstalledAt: Date | null;
}

export interface MailboxRecord {
  id: string;
  portalId: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: Buffer;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: Buffer;
  useSsl: boolean;
  olConnectorId: string;
  olLineId: number;
  lastSeenUid: number | null;
  enabled: boolean;
  lastError: string | null;
  lastPolledAt: Date | null;
}

export interface EmailMessageMapRecord {
  id: string;
  mailboxId: string;
  emailMessageId: string;
  emailInReplyTo: string | null;
  emailSubject: string | null;
  clientEmail: string | null;
  olChatId: bigint;
  olMessageId: bigint | null;
  direction: Direction;
  status: SendStatus;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface BotConfigRecord {
  portalId: string;
  enabled: boolean;
  botB24Id: number | null;
  vibecodeApiKey: Buffer | null;
  systemPrompt: string;
  faq: JsonObject[];
  attachedOlLines: number[];
  handoffAfterMessages: number;
  worktimeOnly: boolean;
}

type PortalWhereUnique = { id?: string; b24MemberId?: string };
type MailboxWhereUnique = { id?: string; portalId?: string };

type PortalFindManyWhere = {
  uninstalledAt?: Date | null;
  tokenExpiresAt?: { lte: Date };
};

type MailboxFindManyWhere = {
  enabled?: boolean;
};

interface PortalStore {
  findUnique(args: { where: PortalWhereUnique }): Promise<PortalRecord | null>;
  findUniqueOrThrow(args: { where: PortalWhereUnique }): Promise<PortalRecord>;
  findMany(args: { where?: PortalFindManyWhere }): Promise<PortalRecord[]>;
  upsert(args: {
    where: { b24MemberId: string };
    create: {
      b24MemberId: string;
      domain: string;
      accessToken: Buffer;
      refreshToken: Buffer;
      tokenExpiresAt: Date;
      applicationToken?: Buffer;
    };
    update: Partial<PortalRecord>;
  }): Promise<PortalRecord>;
  update(args: { where: { id: string }; data: Partial<PortalRecord> }): Promise<PortalRecord>;
}

interface MailboxStore {
  findUnique(args: { where: MailboxWhereUnique }): Promise<MailboxRecord | null>;
  findUniqueOrThrow(args: {
    where: MailboxWhereUnique;
    include?: { portal?: boolean };
  }): Promise<(MailboxRecord & { portal: PortalRecord }) | MailboxRecord>;
  findMany(args: {
    where?: MailboxFindManyWhere;
    include?: { portal?: boolean };
  }): Promise<Array<(MailboxRecord & { portal: PortalRecord }) | MailboxRecord>>;
  upsert(args: {
    where: { portalId: string };
    create: Omit<MailboxRecord, 'id' | 'lastSeenUid' | 'enabled' | 'lastError' | 'lastPolledAt'> & {
      lastSeenUid?: number | null;
      enabled?: boolean;
      lastError?: string | null;
      lastPolledAt?: Date | null;
    };
    update: Partial<MailboxRecord>;
  }): Promise<MailboxRecord>;
  update(args: { where: { id: string }; data: Partial<MailboxRecord> }): Promise<MailboxRecord>;
  delete(args: { where: { id: string } }): Promise<MailboxRecord>;
}

interface BotConfigStore {
  findUnique(args: { where: { portalId: string } }): Promise<BotConfigRecord | null>;
  upsert(args: {
    where: { portalId: string };
    create: BotConfigRecord;
    update: Partial<BotConfigRecord>;
  }): Promise<BotConfigRecord>;
}

interface EmailMessageMapStore {
  create(args: {
    data: Omit<
      EmailMessageMapRecord,
      | 'id'
      | 'createdAt'
      | 'status'
      | 'error'
      | 'sentAt'
      | 'olMessageId'
      | 'emailInReplyTo'
      | 'emailSubject'
      | 'clientEmail'
    > & {
      emailInReplyTo?: string | null;
      emailSubject?: string | null;
      clientEmail?: string | null;
      status?: SendStatus;
      error?: string | null;
      sentAt?: Date | null;
      olMessageId?: bigint | null;
    };
  }): Promise<EmailMessageMapRecord>;
  findFirst(args: {
    where: { olChatId: bigint; direction: Direction };
    orderBy?: { createdAt?: 'asc' | 'desc' };
    include?: { mailbox?: boolean };
  }): Promise<(EmailMessageMapRecord & { mailbox: MailboxRecord }) | EmailMessageMapRecord | null>;
}

export interface AppStore {
  portal: PortalStore;
  mailbox: MailboxStore;
  botConfig: BotConfigStore;
  emailMessageMap: EmailMessageMapStore;
  $queryRaw(query: TemplateStringsArray, ...params: unknown[]): Promise<number>;
}

class InMemoryStore implements AppStore {
  private readonly portalsById = new Map<string, PortalRecord>();
  private readonly portalIdByMemberId = new Map<string, string>();

  private readonly mailboxesById = new Map<string, MailboxRecord>();
  private readonly mailboxIdByPortalId = new Map<string, string>();

  private readonly botConfigByPortalId = new Map<string, BotConfigRecord>();

  private readonly emailMapsById = new Map<string, EmailMessageMapRecord>();

  portal: PortalStore = {
    findUnique: async ({ where }) => this.findPortal(where),
    findUniqueOrThrow: async ({ where }) => {
      const portal = this.findPortal(where);
      if (!portal) {
        throw new Error('Portal not found');
      }
      return portal;
    },
    findMany: async ({ where }) => {
      const all = Array.from(this.portalsById.values());
      return all.filter((portal) => {
        if (where?.uninstalledAt === null && portal.uninstalledAt !== null) {
          return false;
        }
        if (where?.tokenExpiresAt?.lte && portal.tokenExpiresAt > where.tokenExpiresAt.lte) {
          return false;
        }
        return true;
      });
    },
    upsert: async ({ where, create, update }) => {
      const existing = this.findPortal({ b24MemberId: where.b24MemberId });
      if (existing) {
        const next: PortalRecord = {
          ...existing,
          ...update,
          applicationToken:
            update.applicationToken === undefined
              ? existing.applicationToken
              : (update.applicationToken ?? null),
        };
        this.portalsById.set(next.id, next);
        this.portalIdByMemberId.set(next.b24MemberId, next.id);
        return next;
      }
      const created: PortalRecord = {
        id: randomUUID(),
        b24MemberId: create.b24MemberId,
        domain: create.domain,
        accessToken: Buffer.from(create.accessToken),
        refreshToken: Buffer.from(create.refreshToken),
        tokenExpiresAt: create.tokenExpiresAt,
        applicationToken: create.applicationToken ? Buffer.from(create.applicationToken) : null,
        installedAt: new Date(),
        uninstalledAt: null,
      };
      this.portalsById.set(created.id, created);
      this.portalIdByMemberId.set(created.b24MemberId, created.id);
      return created;
    },
    update: async ({ where, data }) => {
      const existing = this.findPortal({ id: where.id });
      if (!existing) {
        throw new Error('Portal not found');
      }
      const next: PortalRecord = {
        ...existing,
        ...data,
        applicationToken:
          data.applicationToken === undefined ? existing.applicationToken : (data.applicationToken ?? null),
      };
      this.portalsById.set(next.id, next);
      this.portalIdByMemberId.set(next.b24MemberId, next.id);
      return next;
    },
  };

  mailbox: MailboxStore = {
    findUnique: async ({ where }) => this.findMailbox(where),
    findUniqueOrThrow: async ({ where, include }) => {
      const mailbox = this.findMailbox(where);
      if (!mailbox) {
        throw new Error('Mailbox not found');
      }
      if (include?.portal) {
        const portal = await this.portal.findUniqueOrThrow({ where: { id: mailbox.portalId } });
        return { ...mailbox, portal };
      }
      return mailbox;
    },
    findMany: async ({ where, include }) => {
      const all = Array.from(this.mailboxesById.values()).filter((mailbox) => {
        if (typeof where?.enabled === 'boolean' && mailbox.enabled !== where.enabled) {
          return false;
        }
        return true;
      });
      if (!include?.portal) {
        return all;
      }
      const withPortals = await Promise.all(
        all.map(async (mailbox) => {
          const portal = await this.portal.findUniqueOrThrow({ where: { id: mailbox.portalId } });
          return { ...mailbox, portal };
        }),
      );
      return withPortals;
    },
    upsert: async ({ where, create, update }) => {
      const existing = this.findMailbox({ portalId: where.portalId });
      if (existing) {
        const next: MailboxRecord = {
          ...existing,
          ...update,
          lastSeenUid: update.lastSeenUid === undefined ? existing.lastSeenUid : (update.lastSeenUid ?? null),
          lastError: update.lastError === undefined ? existing.lastError : (update.lastError ?? null),
          lastPolledAt:
            update.lastPolledAt === undefined ? existing.lastPolledAt : (update.lastPolledAt ?? null),
        };
        this.mailboxesById.set(next.id, next);
        this.mailboxIdByPortalId.set(next.portalId, next.id);
        return next;
      }
      const created: MailboxRecord = {
        id: randomUUID(),
        portalId: create.portalId,
        email: create.email,
        imapHost: create.imapHost,
        imapPort: create.imapPort,
        imapUser: create.imapUser,
        imapPassword: Buffer.from(create.imapPassword),
        smtpHost: create.smtpHost,
        smtpPort: create.smtpPort,
        smtpUser: create.smtpUser,
        smtpPassword: Buffer.from(create.smtpPassword),
        useSsl: create.useSsl,
        olConnectorId: create.olConnectorId,
        olLineId: create.olLineId,
        lastSeenUid: create.lastSeenUid ?? null,
        enabled: create.enabled ?? true,
        lastError: create.lastError ?? null,
        lastPolledAt: create.lastPolledAt ?? null,
      };
      this.mailboxesById.set(created.id, created);
      this.mailboxIdByPortalId.set(created.portalId, created.id);
      return created;
    },
    update: async ({ where, data }) => {
      const existing = this.findMailbox({ id: where.id });
      if (!existing) {
        throw new Error('Mailbox not found');
      }
      const next: MailboxRecord = {
        ...existing,
        ...data,
        lastSeenUid: data.lastSeenUid === undefined ? existing.lastSeenUid : (data.lastSeenUid ?? null),
        lastError: data.lastError === undefined ? existing.lastError : (data.lastError ?? null),
        lastPolledAt: data.lastPolledAt === undefined ? existing.lastPolledAt : (data.lastPolledAt ?? null),
      };
      this.mailboxesById.set(next.id, next);
      this.mailboxIdByPortalId.set(next.portalId, next.id);
      return next;
    },
    delete: async ({ where }) => {
      const mailbox = this.findMailbox({ id: where.id });
      if (!mailbox) {
        throw new Error('Mailbox not found');
      }
      this.mailboxesById.delete(mailbox.id);
      this.mailboxIdByPortalId.delete(mailbox.portalId);
      for (const [id, mapped] of this.emailMapsById) {
        if (mapped.mailboxId === mailbox.id) {
          this.emailMapsById.delete(id);
        }
      }
      return mailbox;
    },
  };

  botConfig: BotConfigStore = {
    findUnique: async ({ where }) => this.botConfigByPortalId.get(where.portalId) ?? null,
    upsert: async ({ where, create, update }) => {
      const existing = this.botConfigByPortalId.get(where.portalId);
      if (existing) {
        const next: BotConfigRecord = {
          ...existing,
          ...update,
          vibecodeApiKey:
            update.vibecodeApiKey === undefined
              ? existing.vibecodeApiKey
              : (update.vibecodeApiKey ?? null),
        };
        this.botConfigByPortalId.set(where.portalId, next);
        return next;
      }
      this.botConfigByPortalId.set(where.portalId, create);
      return create;
    },
  };

  emailMessageMap: EmailMessageMapStore = {
    create: async ({ data }) => {
      const created: EmailMessageMapRecord = {
        id: randomUUID(),
        mailboxId: data.mailboxId,
        emailMessageId: data.emailMessageId,
        emailInReplyTo: data.emailInReplyTo ?? null,
        emailSubject: data.emailSubject ?? null,
        clientEmail: data.clientEmail ?? null,
        olChatId: data.olChatId,
        olMessageId: data.olMessageId ?? null,
        direction: data.direction,
        status: data.status ?? 'pending',
        error: data.error ?? null,
        createdAt: new Date(),
        sentAt: data.sentAt ?? null,
      };
      this.emailMapsById.set(created.id, created);
      return created;
    },
    findFirst: async ({ where, orderBy, include }) => {
      const filtered = Array.from(this.emailMapsById.values()).filter(
        (item) => item.olChatId === where.olChatId && item.direction === where.direction,
      );
      filtered.sort((a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return orderBy?.createdAt === 'desc' ? -diff : diff;
      });
      const first = filtered[0] ?? null;
      if (!first) {
        return null;
      }
      if (!include?.mailbox) {
        return first;
      }
      const mailbox = await this.mailbox.findUniqueOrThrow({ where: { id: first.mailboxId } });
      return { ...first, mailbox: mailbox as MailboxRecord };
    },
  };

  async $queryRaw(_query: TemplateStringsArray, ..._params: unknown[]): Promise<number> {
    return 1;
  }

  private findPortal(where: PortalWhereUnique): PortalRecord | null {
    if (where.id) {
      return this.portalsById.get(where.id) ?? null;
    }
    if (where.b24MemberId) {
      const id = this.portalIdByMemberId.get(where.b24MemberId);
      if (!id) {
        return null;
      }
      return this.portalsById.get(id) ?? null;
    }
    return null;
  }

  private findMailbox(where: MailboxWhereUnique): MailboxRecord | null {
    if (where.id) {
      return this.mailboxesById.get(where.id) ?? null;
    }
    if (where.portalId) {
      const id = this.mailboxIdByPortalId.get(where.portalId);
      if (!id) {
        return null;
      }
      return this.mailboxesById.get(id) ?? null;
    }
    return null;
  }
}

const globalForStore = globalThis as typeof globalThis & {
  commHubStore?: AppStore;
};

export const prisma = globalForStore.commHubStore ?? new InMemoryStore();

if (process.env.NODE_ENV !== 'production') {
  globalForStore.commHubStore = prisma;
}
