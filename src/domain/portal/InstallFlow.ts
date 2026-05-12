import type { PrismaClient } from '@prisma/client';
import { encryptSecret } from '../../crypto.js';
import type { JsonObject } from '../../types.js';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  domain: string;
  member_id: string;
}

export interface InstallFlowInput {
  code: string;
  domain: string;
  applicationToken?: string;
}

export interface InstallFlowConfig {
  clientId: string;
  clientSecret: string;
  masterKeyBase64: string;
}

export class InstallFlow {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: InstallFlowConfig,
  ) {}

  async exchangeCode(input: InstallFlowInput): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: input.code,
    });
    const response = await fetch(`https://${input.domain}/oauth/token/?${params.toString()}`);
    const payload = (await response.json()) as JsonObject;
    if (!response.ok || typeof payload.access_token !== 'string') {
      throw new Error('Bitrix24 OAuth token exchange failed');
    }
    return {
      access_token: payload.access_token,
      refresh_token: String(payload.refresh_token),
      expires_in: Number(payload.expires_in ?? 3600),
      domain: String(payload.domain ?? input.domain),
      member_id: String(payload.member_id),
    };
  }

  async install(input: InstallFlowInput): Promise<{ portalId: string; domain: string }> {
    const token = await this.exchangeCode(input);
    const accessToken = await encryptSecret(token.access_token, this.config.masterKeyBase64);
    const refreshToken = await encryptSecret(token.refresh_token, this.config.masterKeyBase64);
    const applicationToken = input.applicationToken
      ? await encryptSecret(input.applicationToken, this.config.masterKeyBase64)
      : undefined;

    const portal = await this.prisma.portal.upsert({
      where: { b24MemberId: token.member_id },
      create: {
        b24MemberId: token.member_id,
        domain: token.domain,
        accessToken,
        refreshToken,
        applicationToken,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
      update: {
        domain: token.domain,
        accessToken,
        refreshToken,
        applicationToken,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        uninstalledAt: null,
      },
    });

    return { portalId: portal.id, domain: token.domain };
  }
}
