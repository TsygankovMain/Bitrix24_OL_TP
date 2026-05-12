import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../config.js';
import { decryptSecret, encryptSecret } from '../crypto.js';
import { logger } from '../logger.js';
import type { JsonObject } from '../types.js';

export class TokenRefresher {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.refreshDueTokens();
    }, 30 * 60_000);
    void this.refreshDueTokens();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async refreshDueTokens(): Promise<void> {
    const due = await this.prisma.portal.findMany({
      where: {
        uninstalledAt: null,
        tokenExpiresAt: { lte: new Date(Date.now() + 5 * 60_000) },
      },
    });
    for (const portal of due) {
      try {
        const refreshToken = await decryptSecret(
          portal.refreshToken,
          this.config.MASTER_ENCRYPTION_KEY_BASE64,
        );
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.B24_CLIENT_ID,
          client_secret: this.config.B24_CLIENT_SECRET,
          refresh_token: refreshToken,
        });
        const response = await fetch(`https://${portal.domain}/oauth/token/?${params.toString()}`);
        const payload = (await response.json()) as JsonObject;
        if (!response.ok || typeof payload.access_token !== 'string') {
          throw new Error('Bitrix24 token refresh failed');
        }
        await this.prisma.portal.update({
          where: { id: portal.id },
          data: {
            accessToken: await encryptSecret(
              String(payload.access_token),
              this.config.MASTER_ENCRYPTION_KEY_BASE64,
            ),
            refreshToken: await encryptSecret(
              String(payload.refresh_token),
              this.config.MASTER_ENCRYPTION_KEY_BASE64,
            ),
            tokenExpiresAt: new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000),
          },
        });
      } catch (error) {
        logger.warn({ portalId: portal.id, error }, 'portal token refresh failed');
      }
    }
  }
}
