export interface BitrixFrameAuth {
  memberId: string;
  domain: string;
  authId?: string;
}

export function readBitrixFrameAuth(): BitrixFrameAuth | null {
  const params = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes('?')
    ? new URLSearchParams(window.location.hash.slice(window.location.hash.indexOf('?') + 1))
    : new URLSearchParams();

  const memberId = params.get('member_id') ?? hashQuery.get('member_id');
  const domain =
    params.get('DOMAIN') ??
    params.get('domain') ??
    hashQuery.get('DOMAIN') ??
    hashQuery.get('domain');
  const authId = params.get('AUTH_ID') ?? hashQuery.get('AUTH_ID') ?? undefined;

  if (!memberId || !domain) {
    return null;
  }

  return { memberId, domain, authId };
}
