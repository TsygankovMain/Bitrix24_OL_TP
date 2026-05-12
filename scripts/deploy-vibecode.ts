const apiKey = process.env.VIBECODE_API_KEY;
const baseUrl = process.env.VIBECODE_BASE_URL ?? 'https://vibecode.bitrix24.tech';
const serverId = process.env.VIBECODE_SERVER_ID;
const sourceUrl = process.env.VIBECODE_SOURCE_URL;

if (!apiKey || !serverId || !sourceUrl) {
  throw new Error('VIBECODE_API_KEY, VIBECODE_SERVER_ID, and VIBECODE_SOURCE_URL are required');
}

const response = await fetch(`${baseUrl}/v1/infra/servers/${serverId}/deploy`, {
  method: 'POST',
  headers: {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    source: { url: sourceUrl },
    port: 3000,
    preStart: 'npm ci && npx prisma migrate deploy && npm run build',
    start: 'npm run start',
    env: {
      NODE_ENV: 'production',
    },
  }),
});

const payload = (await response.json()) as unknown;
if (!response.ok) {
  throw new Error(`Deploy failed: ${response.status} ${JSON.stringify(payload)}`);
}

console.log(JSON.stringify(payload, null, 2));
