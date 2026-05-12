const apiKey = process.env.VIBECODE_API_KEY;
const baseUrl = process.env.VIBECODE_BASE_URL ?? 'https://vibecode.bitrix24.tech';
const serverId = process.env.VIBECODE_SERVER_ID;
const sourceUrl = process.env.VIBECODE_SOURCE_URL ?? 'https://github.com/TsygankovMain/Bitrix24_OL_TP/archive/main.tar.gz';

if (!apiKey || !serverId) {
  throw new Error('VIBECODE_API_KEY and VIBECODE_SERVER_ID are required');
}

const env = {
  NODE_ENV: 'production',
  APP_BASE_URL: process.env.APP_BASE_URL ?? 'https://app-aff6e43ead1e.vibecode.bitrix24.tech',
  DATABASE_URL: process.env.DATABASE_URL,
  B24_CLIENT_ID: process.env.B24_CLIENT_ID,
  B24_CLIENT_SECRET: process.env.B24_CLIENT_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  MASTER_ENCRYPTION_KEY_BASE64: process.env.MASTER_ENCRYPTION_KEY_BASE64,
  VIBECODE_API_KEY: process.env.VIBECODE_API_KEY,
  VIBECODE_BASE_URL: baseUrl,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET ?? 'comm-hub-attachments',
  SUPABASE_STORAGE_SERVICE_KEY: process.env.SUPABASE_STORAGE_SERVICE_KEY,
  DISABLE_WORKERS: process.env.DISABLE_WORKERS ?? 'true',
  SKIP_DB_HEALTH: process.env.SKIP_DB_HEALTH ?? 'true',
};

if (!env.B24_CLIENT_ID || !env.B24_CLIENT_SECRET) {
  throw new Error('B24_CLIENT_ID and B24_CLIENT_SECRET are required for deployment');
}
if (!env.JWT_SECRET || !env.MASTER_ENCRYPTION_KEY_BASE64) {
  throw new Error('JWT_SECRET and MASTER_ENCRYPTION_KEY_BASE64 are required for deployment');
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
    preStart: 'npm ci && npm run build',
    start: 'npm run start',
    env,
  }),
});

const payload = (await response.json()) as unknown;
if (!response.ok) {
  throw new Error(`Deploy failed: ${response.status} ${JSON.stringify(payload)}`);
}

console.log(JSON.stringify(payload, null, 2));
