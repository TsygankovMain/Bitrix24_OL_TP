function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const apiKey = requiredEnv('VIBECODE_API_KEY');
const baseUrl = process.env.VIBECODE_BASE_URL ?? 'https://vibecode.bitrix24.tech';

async function request(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`VibeCode request failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

const code = `comm_hub_spike_${Date.now()}`;
const registered = await request('/v1/bots', {
  method: 'POST',
  body: JSON.stringify({
    code,
    name: 'Comm Hub Spike Bot',
    type: 'openline',
    eventMode: 'fetch',
    workPosition: 'Spike bot for Comm Hub MVP',
  }),
});

console.log(JSON.stringify({ registered }, null, 2));
