import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';

export interface SessionClaims {
  portalId: string;
  memberId: string;
  domain: string;
  userId?: string;
}

export function signSession(claims: SessionClaims, secret: string): string {
  return jwt.sign(claims, secret, { expiresIn: '15m' });
}

export function verifySession(token: string, secret: string): SessionClaims {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid session token');
  }
  const payload = decoded as Partial<SessionClaims>;
  if (!payload.portalId || !payload.memberId || !payload.domain) {
    throw new Error('Invalid session token claims');
  }
  return {
    portalId: payload.portalId,
    memberId: payload.memberId,
    domain: payload.domain,
    userId: payload.userId,
  };
}

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}
