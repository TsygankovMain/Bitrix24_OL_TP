# План реализации MVP «Центр коммуникаций для Битрикс24»

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Источник требований:** [docs/superpowers/specs/2026-05-12-comm-hub-mvp-design.md](../specs/2026-05-12-comm-hub-mvp-design.md)

**Цель:** За 6–7 спринтов (~7 чел-недель) построить тиражируемое для Маркета Б24 приложение «Центр коммуникаций», которое (1) показывает единый Inbox всех Открытых линий портала, (2) подключает корпоративную почту как ОЛ-коннектор через IMAP/SMTP, (3) предоставляет конфигурируемого AI-бота на базе VibeCode AI Router.

**Архитектура:** Монолит на Node.js 20 + Fastify, развёрнут на VibeCode Infra. Хранилище — внешний managed Postgres (Supabase). Domain-логика изолирована от vendor-зависимостей через единые обёртки (`src/vendor/vibecode.ts`, `src/vendor/b24.ts`) — это оплачивает будущую миграцию на свой сервер. Frontend — React SPA, отдаётся тем же Fastify, авторизация через iframe-параметры Б24.

**Стек:** TypeScript 5, Fastify 4, Prisma 5, React 18, Vite 5, Vitest, libsodium-wrappers, imapflow, nodemailer, mailparser, p-queue, pino. AI: VibeCode AI Router (`bitrix/bitrixgpt-5`). Бот: OpenClaw (`@ihazz/bitrix24`).

---

## Структура спринтов

| #   | Спринт             | Длит.  | Цель                                    | Выход                                              |
| --- | ------------------ | ------ | --------------------------------------- | -------------------------------------------------- |
| 0   | Спайк рисков R1–R6 | 5 дней | Проверить, что VibeCode-инфра подходит  | Risk-report + go/no-go                             |
| 1   | Foundation         | 5 дней | Скелет, OAuth, vendor-адаптеры, JWT     | Приложение устанавливается на портал, видит токены |
| 2   | Email Connector    | 7 дней | Полный поток вход/исход через IMAP/SMTP | Письмо → OL и обратно                              |
| 3   | Inbox UI           | 5 дней | Двухпанельный inbox с polling           | Оператор пишет ответы из нашего UI                 |
| 4   | Bot                | 7 дней | OpenClaw + FAQ + handoff                | Бот отвечает по FAQ, передаёт оператору            |
| 5   | Production         | 5 дней | CI/CD, healthcheck, удаление            | Прод-деплой, ручная QA по критериям приёмки        |

---

## Карта файлов (что создаётся за весь проект)

```
/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── vitest.config.ts
├── .env.example
├── README.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts                          # entry point, поднимает Fastify + workers
│   ├── config.ts                        # парсинг env, единая точка
│   ├── crypto.ts                        # sealed-box обёртки на libsodium
│   ├── logger.ts                        # pino instance
│   ├── http/
│   │   ├── server.ts                    # buildServer(): Fastify factory
│   │   ├── auth.ts                      # JWT для SPA, validateB24IframeAuth
│   │   └── routes/
│   │       ├── oauth.ts                 # /oauth/install, /oauth/callback
│   │       ├── api.ts                   # /api/* для SPA
│   │       └── webhooks.ts              # /webhooks/b24
│   ├── domain/
│   │   ├── email/
│   │   │   ├── EmailParser.ts           # trimQuoted, htmlToPlain, parseAddress
│   │   │   ├── IncomingEmailHandler.ts
│   │   │   └── OutgoingEmailHandler.ts
│   │   ├── connector/
│   │   │   ├── ConnectorRegistration.ts # imconnector.register/activate
│   │   │   └── MessageBridge.ts         # email ↔ OL message bridge
│   │   ├── bot/
│   │   │   ├── BotConfiguration.ts
│   │   │   ├── BotResponder.ts          # FAQ match + LLM
│   │   │   └── HandoffPolicy.ts
│   │   └── portal/
│   │       ├── InstallFlow.ts           # OAuth callback handler
│   │       └── UninstallFlow.ts
│   ├── vendor/
│   │   ├── vibecode.ts                  # AI Router + OpenClaw + Infra deploys
│   │   ├── b24.ts                       # B24 REST client (per-portal)
│   │   └── supabase.ts                  # PrismaClient singleton
│   ├── workers/
│   │   ├── imapPoller.ts                # каждые 60 сек по каждому ящику
│   │   ├── smtpSender.ts                # p-queue, исходящие
│   │   └── tokenRefresher.ts            # 30-мин loop, OAuth refresh
│   └── ports/                           # типы-интерфейсы для domain → vendor
│       ├── AIPort.ts
│       ├── B24Port.ts
│       └── BotPlatformPort.ts
├── web/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts                # fetch к /api/* с JWT
│       ├── auth/
│       │   └── b24Iframe.ts             # парсинг AUTH_ID из URL/postMessage
│       ├── pages/
│       │   ├── Inbox.tsx
│       │   └── Settings.tsx
│       └── components/
│           ├── DialogList.tsx
│           ├── MessagePane.tsx
│           ├── Composer.tsx
│           ├── MailboxForm.tsx
│           └── BotForm.tsx
├── tests/
│   ├── domain/
│   │   ├── email/EmailParser.test.ts
│   │   ├── connector/MessageBridge.test.ts
│   │   └── bot/BotResponder.test.ts
│   └── integration/
│       ├── imap-flow.test.ts
│       └── webhook-smtp.test.ts
├── scripts/
│   ├── deploy-vibecode.ts               # POST /v1/infra/servers/{id}/deploy
│   └── register-marketplace.md          # инструкция для регистрации в Маркете
└── docs/
    └── superpowers/
        ├── specs/2026-05-12-comm-hub-mvp-design.md
        └── plans/2026-05-12-comm-hub-mvp-plan.md   # ← этот файл
```

---

## Соглашения

- **Языки коммитов:** conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). По-английски — единообразие для CI.
- **TDD:** для domain/-кода — обязательно (failing test → impl). Для vendor/-обёрток и HTTP-эндпоинтов — контрактный тест после реализации (recorded cassette).
- **Линт + формат:** `npm run lint` и `npm run format` в pre-commit hook (husky + lint-staged).
- **Никаких placeholder'ов в коде.** «TODO» допустимы только с привязкой к задаче из этого плана: `// TODO(T4.5): handoff rules`.
- **Без `any`** в продакшен-коде. В тестах допустимо.

---

# СПРИНТ 0 — Спайк рисков R1–R6 (5 дней)

**Цель:** До начала основной разработки проверить 6 рисков из спеки. Если хоть один фатально проваливается — пересмотр стека до Sprint 1.

**Выход:** документ `docs/spike-report.md` с пометками PASS / FAIL / MITIGATED по каждому риску, и решение go/no-go.

**Принцип спайка:** ровно столько кода, сколько нужно проверить риск. Никакой архитектуры. Всё на скорость, потом выбрасывается.

---

### Task 0.1: Инициализация репозитория и тестового аккаунта VibeCode

**Files:**

- Create: `package.json`, `tsconfig.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Инициализировать репозиторий**

```bash
git init
npm init -y
npm install --save-dev typescript@5 tsx @types/node
npx tsc --init --target es2022 --module nodenext --moduleResolution nodenext \
  --outDir dist --rootDir src --strict --esModuleInterop --resolveJsonModule
```

- [ ] **Step 2: Создать `.gitignore`**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
spike/.cache/
```

- [ ] **Step 3: Создать `README.md` минимальный**

```markdown
# Comm Hub — Bitrix24 Marketplace App

MVP — см. docs/superpowers/specs/2026-05-12-comm-hub-mvp-design.md
План реализации — см. docs/superpowers/plans/2026-05-12-comm-hub-mvp-plan.md
Спринт 0 — спайк рисков.
```

- [ ] **Step 4: Получить тестовый портал Б24**

Зарегистрировать бесплатный пробный портал `comm-hub-test.bitrix24.ru`. Создать тестового пользователя с ролью «Администратор».

- [ ] **Step 5: Получить VibeCode API ключ**

На `https://vibecode.bitrix24.tech/keys` — создать ключ со scopes: `imbot`, `vibe:ai`, `infra`. Сохранить в `.env.spike`:

```
VIBECODE_API_KEY=<key>
B24_TEST_PORTAL=https://comm-hub-test.bitrix24.ru
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: bootstrap repo for sprint 0 spike"
```

---

### Task 0.2: Создать тестовое приложение Б24 (для последующих рисков)

**Files:**

- Create: `spike/app-manifest.json`

- [ ] **Step 1: Заявка локального приложения**

В админке тестового портала: `Приложения` → `Разработчикам` → `Другое` → `Локальное приложение`. Заполнить:

- Адрес обработчика: `https://app-XXXX.vibecode.bitrix24.tech/spike` (URL появится в задаче 0.3)
- Адрес установки: тот же
- Права: `imopenlines, imconnector, imbot, im, crm, user, disk, event`
- Сохранить `client_id` и `client_secret` в `.env.spike`

- [ ] **Step 2: Зафиксировать `app-manifest.json` для дальнейшей подачи в Маркет**

```json
{
  "code": "comm.hub",
  "name": "Центр коммуникаций (spike)",
  "scope": ["imopenlines", "imconnector", "imbot", "im", "crm", "user", "disk", "event"],
  "placement": [
    { "code": "LEFT_MENU", "handler": "/app#/inbox" },
    { "code": "SETTINGS_CONNECTOR", "handler": "/app#/settings" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add spike/
git commit -m "chore(spike): add b24 app manifest for risk verification"
```

---

### Task 0.3: R1 — Webhook reachability к VibeCode Infra

**Files:**

- Create: `spike/r1-webhook/index.ts`, `spike/r1-webhook/deploy.sh`

- [ ] **Step 1: Минимальный Fastify-сервер, логирующий все POST**

```typescript
// spike/r1-webhook/index.ts
import Fastify from 'fastify';
const app = Fastify({ logger: true });
app.post('/webhook', async (req, reply) => {
  console.log('WEBHOOK RECEIVED:', JSON.stringify(req.body));
  return { ok: true };
});
app.get('/healthz', async () => ({ status: 'ok' }));
app.listen({ port: 3000, host: '0.0.0.0' });
```

- [ ] **Step 2: Создать VibeCode-сервер и задеплоить**

```bash
# Создать сервер
curl -X POST https://vibecode.bitrix24.tech/v1/infra/servers \
  -H "X-Api-Key: $VIBECODE_API_KEY" \
  -d '{"name":"spike-r1","runtime":"nodejs20","plan":"bc-small"}' \
  | tee /tmp/r1-server.json

# Запомнить server-id
export R1_SERVER_ID=$(jq -r .id /tmp/r1-server.json)

# Запаковать
tar -czf /tmp/spike-r1.tar.gz spike/r1-webhook/

# Деплой (детали API см. в /docs/api-reference)
curl -X POST "https://vibecode.bitrix24.tech/v1/infra/servers/$R1_SERVER_ID/deploy" \
  -H "X-Api-Key: $VIBECODE_API_KEY" \
  -F "source=@/tmp/spike-r1.tar.gz" \
  -F 'install=npm i fastify' \
  -F 'start=npx tsx index.ts' \
  -F 'port=3000'
```

Если шаги выше API не подходят — следовать актуальной документации на `/docs/infra` и зафиксировать в `spike-report.md` команды.

- [ ] **Step 3: Зарегистрировать event-bind на тестовом портале**

```bash
APP_URL="https://app-$R1_SERVER_ID.vibecode.bitrix24.tech"
curl -X POST "$B24_TEST_PORTAL/rest/event.bind.json" \
  -d "auth=<ACCESS_TOKEN_OF_TEST_USER>" \
  -d "event=ONIMOPENLINESSESSIONSTART" \
  -d "handler=$APP_URL/webhook"
```

- [ ] **Step 4: Спровоцировать событие**

Зайти в виджет Б24-чата на тестовом портале (от лица анонимного клиента), написать «test». Должна стартовать OL-сессия.

- [ ] **Step 5: Проверить логи VibeCode-сервера**

```bash
curl "https://vibecode.bitrix24.tech/v1/infra/servers/$R1_SERVER_ID/logs?lines=200" \
  -H "X-Api-Key: $VIBECODE_API_KEY"
```

**PASS:** в логах виден `WEBHOOK RECEIVED: {"event":"ONIMOPENLINESSESSIONSTART",...}`. Записать в `spike-report.md` PASS, латентность от события до лога.

**FAIL (нет лога):** проверить — приходят ли вообще к нам запросы? Сделать `curl POST $APP_URL/webhook -d 'test'` извне. Если внешний curl не доходит — Infra блокирует входящие → FAIL R1 → план Б: polling `event.offline.list`.

- [ ] **Step 6: Записать результат**

```bash
echo "## R1 — Webhook reachability" >> docs/spike-report.md
echo "**Result:** PASS / FAIL / MITIGATED" >> docs/spike-report.md
echo "**Latency:** Xms" >> docs/spike-report.md
echo "**Notes:** ..." >> docs/spike-report.md
git add docs/spike-report.md && git commit -m "spike(r1): webhook reachability — <RESULT>"
```

---

### Task 0.4: R2 — Persistent FS на VibeCode-сервере

**Files:**

- Modify: `spike/r1-webhook/index.ts` (расширяем функционал, чтобы переиспользовать тот же сервер)

- [ ] **Step 1: Добавить endpoint'ы для записи/чтения файла**

```typescript
// дополнить index.ts:
import fs from 'fs/promises';
import path from 'path';

const STORE = process.env.STORE_PATH || '/data/test.txt';

app.post('/fs/write', async (req) => {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  await fs.writeFile(STORE, JSON.stringify({ at: new Date().toISOString(), data: req.body }));
  return { ok: true, path: STORE };
});
app.get('/fs/read', async () => {
  try {
    return JSON.parse(await fs.readFile(STORE, 'utf8'));
  } catch (e: any) {
    return { error: e.message };
  }
});
```

- [ ] **Step 2: Передеплоить и записать данные**

```bash
tar -czf /tmp/spike-r1.tar.gz spike/r1-webhook/
# re-deploy (повторить команду из 0.3 step 2)
curl -X POST "$APP_URL/fs/write" -H "Content-Type: application/json" -d '{"hello":"world"}'
curl "$APP_URL/fs/read"
```

Зафиксировать ответ.

- [ ] **Step 3: Триггернуть redeploy**

Передеплоить тот же артефакт повторно. После — вызвать `GET /fs/read`.

**PASS:** возвращается ранее записанное `{hello:"world"}` — FS персистентный.
**FAIL:** `{error: "ENOENT"}` — FS эфемерный, все persistent данные обязаны жить во внешних сервисах. План Б в спеке (Supabase для всего) уже учитывает этот случай.

- [ ] **Step 4: Записать результат**

```bash
echo "## R2 — Persistent FS" >> docs/spike-report.md
echo "**Result:** ..." >> docs/spike-report.md
git add docs/spike-report.md && git commit -m "spike(r2): persistent fs — <RESULT>"
```

---

### Task 0.5: R3 — Auto-sleep behavior

**Files:**

- Modify: `spike/r1-webhook/index.ts`

- [ ] **Step 1: Добавить heartbeat-лог**

```typescript
setInterval(() => console.log('HB', new Date().toISOString()), 30_000);
```

Передеплой.

- [ ] **Step 2: Изучить документацию `/sleep`**

```bash
curl "https://vibecode.bitrix24.tech/v1/infra/servers/$R1_SERVER_ID" \
  -H "X-Api-Key: $VIBECODE_API_KEY" | jq
# проверить флаг sleep / autoSleep
```

- [ ] **Step 3: Запросить отключение auto-sleep**

```bash
curl -X PATCH "https://vibecode.bitrix24.tech/v1/infra/servers/$R1_SERVER_ID/sleep" \
  -H "X-Api-Key: $VIBECODE_API_KEY" \
  -d '{"enabled":false}'
```

- [ ] **Step 4: Подождать 15 минут без активности**

После 15 минут — проверить логи: продолжают ли идти HB-сообщения?

**PASS:** HB идут все 15 минут, sleep отключаемый.
**FAIL/MITIGATED:** sleep не отключаемый → планируем внешний пингер (`cron-job.org` каждые 5 минут на `/healthz`).

- [ ] **Step 5: Записать результат, commit**

```bash
echo "## R3 — Auto-sleep" >> docs/spike-report.md
# ...
git add docs/spike-report.md && git commit -m "spike(r3): auto-sleep — <RESULT>"
```

---

### Task 0.6: R4 — Outbound networking (IMAP/SMTP)

**Files:**

- Create: `spike/r4-imap-smtp/index.ts`

- [ ] **Step 1: Подключаемся к Яндекс IMAP с VibeCode-сервера**

```typescript
// spike/r4-imap-smtp/index.ts
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

const IMAP = process.env.IMAP_PASS!;
const SMTP = process.env.SMTP_PASS!;
const EMAIL = process.env.TEST_EMAIL!;

async function testImap() {
  const c = new ImapFlow({
    host: 'imap.yandex.ru',
    port: 993,
    secure: true,
    auth: { user: EMAIL, pass: IMAP },
    logger: false,
  });
  await c.connect();
  const lock = await c.getMailboxLock('INBOX');
  try {
    console.log('IMAP OK, messages:', c.mailbox?.exists);
  } finally {
    lock.release();
    await c.logout();
  }
}

async function testSmtp() {
  const t = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: { user: EMAIL, pass: SMTP },
  });
  await t.verify();
  console.log('SMTP OK');
}

testImap().catch((e) => console.error('IMAP FAIL:', e.message));
testSmtp().catch((e) => console.error('SMTP FAIL:', e.message));
```

- [ ] **Step 2: Деплой как отдельный VibeCode-сервер**

```bash
# создать r4-server, задеплоить, передать env IMAP_PASS, SMTP_PASS, TEST_EMAIL
# использовать тот же приём что в 0.3
```

- [ ] **Step 3: Прогнать и зафиксировать логи**

**PASS:** оба коннекта прошли.
**FAIL по одному из портов:** фиксируем какой порт блокируется (993/465/587), отмечаем в плане Б требование «работать через STARTTLS на 25/143 или через relay».

- [ ] **Step 4: Записать результат, commit**

---

### Task 0.7: R5 — OpenClaw multi-tenancy

**Files:**

- Create: `spike/r5-openclaw/index.ts`

- [ ] **Step 1: Установить `@ihazz/bitrix24` плагин OpenClaw**

```bash
mkdir spike/r5-openclaw && cd spike/r5-openclaw
npm init -y && npm install @ihazz/bitrix24
```

- [ ] **Step 2: Зарегистрировать OpenClaw для тестового портала**

Следовать актуальной документации `/docs/openclaw`. Цель: получить регистрацию бота `imbot.register` на тестовом портале через OpenClaw.

- [ ] **Step 3: Подключить второй тестовый портал**

Создать второй пробный портал `comm-hub-test-2.bitrix24.ru`, подключить к тому же экземпляру OpenClaw.

- [ ] **Step 4: Проверить изоляцию**

Отправить сообщение боту на портале 1, проверить что на портале 2 ничего не пришло, и наоборот.

**PASS:** Один OpenClaw обслуживает оба портала, токены/чаты не смешиваются → используем как описано в спеке.
**FAIL (нужен экземпляр на портал):** план Б — fallback к ручному `imbot.register` per-portal, бот логика в нашем коде. Это +3 чел-дня к Sprint 4.
**FAIL (общий экземпляр, но утечка):** критично. Откатываемся к ручному `imbot.register`.

- [ ] **Step 5: Записать результат, commit**

---

### Task 0.8: R6 — Supabase capacity

**Files:**

- Create: `spike/r6-supabase/README.md`

- [ ] **Step 1: Создать Supabase free-tier проект**

`https://supabase.com` → New project → free tier. Зафиксировать `DATABASE_URL` в `.env.spike`.

- [ ] **Step 2: Прикинуть нагрузку**

```
500 порталов × 10 КБ метаданных = 5 МБ (запас 100× от лимита 500 МБ).
500 × 1 ящик × 200 писем/мес × 1 КБ записи в email_message_map = 100 МБ/мес.
1 год = 1.2 ГБ → free tier недостаточно при выходе на 500 порталов.
```

- [ ] **Step 3: Проверить пулл соединений**

Свободный тариф — 60 соединений direct, через pooler — 200. С 1 backend-инстансом + Prisma — нам нужно < 20.

**PASS:** free tier хватает на старт (~50 порталов), при 100+ — переезжаем на платный/Neon.
**Запас плана Б:** Neon бесплатный (3 ГБ + ветвление). Платный Supabase — $25/мес.

- [ ] **Step 4: Записать результат, commit**

---

### Task 0.9: Сводный risk-report и решение go/no-go

**Files:**

- Modify: `docs/spike-report.md` (финализация)

- [ ] **Step 1: Свести таблицу**

```markdown
# Sprint 0 Risk Report

| Риск          | Результат   | Митигация | Влияние на план |
| ------------- | ----------- | --------- | --------------- |
| R1 Webhook    | PASS / FAIL | ...       | ...             |
| R2 FS         | ...         | ...       | ...             |
| R3 Sleep      | ...         | ...       | ...             |
| R4 Networking | ...         | ...       | ...             |
| R5 OpenClaw   | ...         | ...       | ...             |
| R6 DB         | ...         | ...       | ...             |

## Решение go/no-go: GO / NO-GO

## Изменения в плане (если есть)
```

- [ ] **Step 2: Удалить тестовые VibeCode-серверы**

```bash
curl -X DELETE "https://vibecode.bitrix24.tech/v1/infra/servers/$R1_SERVER_ID" \
  -H "X-Api-Key: $VIBECODE_API_KEY"
# и для остальных
```

- [ ] **Step 3: Commit с тэгом версии**

```bash
git add -A && git commit -m "docs: sprint 0 risk report — GO/NO-GO"
git tag sprint-0-complete
```

---

# СПРИНТ 1 — Foundation (5 дней)

**Цель:** Собрать рабочий backend-скелет с OAuth-установкой на портал, прохождением миграций БД, базовыми vendor-обёртками.

**Definition of Done:** Локально и на VibeCode деплое — приложение устанавливается на тестовый портал в 1 клик, в `portals` появляется запись, токены успешно рефрешатся, в логах нет ошибок 1 час подряд.

---

### Task 1.1: Полная инициализация проекта (TypeScript, Fastify, ESLint, Prettier, Vitest)

**Files:**

- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`, `.env.example`

- [ ] **Step 1: Установить зависимости**

```bash
npm install fastify@^4 pino@^9 prisma@^5 @prisma/client@^5 \
  libsodium-wrappers @types/libsodium-wrappers \
  imapflow nodemailer mailparser p-queue \
  zod @fastify/cookie @fastify/helmet @fastify/cors \
  jsonwebtoken @types/jsonwebtoken
npm install --save-dev typescript@5 tsx vitest @vitest/coverage-v8 \
  @types/node @types/nodemailer @types/mailparser \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  prettier eslint-config-prettier eslint-plugin-prettier \
  husky lint-staged
```

- [ ] **Step 2: Создать `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", "web"]
}
```

- [ ] **Step 3: `.eslintrc.cjs` и `.prettierrc`**

```javascript
// .eslintrc.cjs
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prettier/prettier': 'error',
  },
  ignorePatterns: ['dist', 'node_modules', 'web'],
};
```

```json
// .prettierrc
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true }
```

- [ ] **Step 4: `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/main.ts'] },
  },
});
```

- [ ] **Step 5: `package.json` scripts**

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests --ext .ts",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "db:migrate": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "prepare": "husky install"
  }
}
```

- [ ] **Step 6: `.env.example`**

```
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/commhub
B24_CLIENT_ID=
B24_CLIENT_SECRET=
MASTER_ENCRYPTION_KEY_BASE64=
VIBECODE_API_KEY=
JWT_SECRET=
LOG_LEVEL=info
```

- [ ] **Step 7: Husky pre-commit**

```bash
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

```json
// в package.json добавить:
"lint-staged": {
  "*.ts": ["eslint --fix", "prettier --write"]
}
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: bootstrap TS + Fastify + Prisma + Vitest tooling"
```

---

### Task 1.2: Prisma schema и первая миграция

**Files:**

- Create: `prisma/schema.prisma`, `prisma/migrations/...`

- [ ] **Step 1: Инициализация Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Заполнить `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Portal {
  id                 String    @id @default(uuid()) @db.Uuid
  b24MemberId        String    @unique @map("b24_member_id")
  domain             String
  accessToken        Bytes     @map("access_token")
  refreshToken       Bytes     @map("refresh_token")
  tokenExpiresAt     DateTime  @map("token_expires_at")
  applicationToken   Bytes?    @map("application_token")
  installedAt        DateTime  @default(now()) @map("installed_at")
  uninstalledAt      DateTime? @map("uninstalled_at")
  mailbox            Mailbox?
  botConfig          BotConfig?
  @@map("portals")
}

model Mailbox {
  id              String   @id @default(uuid()) @db.Uuid
  portalId        String   @unique @map("portal_id") @db.Uuid
  email           String
  imapHost        String   @map("imap_host")
  imapPort        Int      @map("imap_port")
  imapUser        String   @map("imap_user")
  imapPassword    Bytes    @map("imap_password")
  smtpHost        String   @map("smtp_host")
  smtpPort        Int      @map("smtp_port")
  smtpUser        String   @map("smtp_user")
  smtpPassword    Bytes    @map("smtp_password")
  useSsl          Boolean  @default(true) @map("use_ssl")
  olConnectorId   String   @map("ol_connector_id")
  olLineId        Int      @map("ol_line_id")
  lastSeenUid     Int?     @map("last_seen_uid")
  enabled         Boolean  @default(true)
  lastError       String?  @map("last_error")
  lastPolledAt    DateTime? @map("last_polled_at")
  portal          Portal   @relation(fields: [portalId], references: [id], onDelete: Cascade)
  emailMaps       EmailMessageMap[]
  @@map("mailboxes")
}

model EmailMessageMap {
  id               String   @id @default(uuid()) @db.Uuid
  mailboxId        String   @map("mailbox_id") @db.Uuid
  emailMessageId   String   @map("email_message_id")
  emailInReplyTo   String?  @map("email_in_reply_to")
  olChatId         BigInt   @map("ol_chat_id")
  olMessageId      BigInt?  @map("ol_message_id")
  direction        String
  status           String   @default("pending")
  error            String?
  createdAt        DateTime @default(now()) @map("created_at")
  sentAt           DateTime? @map("sent_at")
  mailbox          Mailbox  @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  @@index([olChatId])
  @@index([emailMessageId])
  @@map("email_message_map")
}

model BotConfig {
  portalId               String   @id @map("portal_id") @db.Uuid
  enabled                Boolean  @default(false)
  botB24Id               Int?     @map("bot_b24_id")
  vibecodeApiKey         Bytes?   @map("vibecode_api_key")
  systemPrompt           String   @default("") @map("system_prompt")
  faq                    Json     @default("[]")
  attachedOlLines        Int[]    @default([]) @map("attached_ol_lines")
  handoffAfterMessages   Int      @default(3) @map("handoff_after_messages")
  worktimeOnly           Boolean  @default(false) @map("worktime_only")
  portal                 Portal   @relation(fields: [portalId], references: [id], onDelete: Cascade)
  @@map("bot_config")
}
```

- [ ] **Step 3: Сгенерировать первую миграцию (локальный Postgres в Docker)**

```bash
# docker-compose.dev.yml — для локальной разработки
cat > docker-compose.dev.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: commhub
    ports: ["5432:5432"]
    volumes: ["pg-data:/var/lib/postgresql/data"]
volumes:
  pg-data:
EOF
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate dev --name initial
```

- [ ] **Step 4: Зафиксировать миграцию в git**

```bash
git add prisma/ docker-compose.dev.yml && git commit -m "feat(db): initial prisma schema with 4 tables"
```

---

### Task 1.3: Модуль `config.ts` — парсинг env с валидацией

**Files:**

- Create: `src/config.ts`, `tests/config.test.ts`

- [ ] **Step 1: Тест на отсутствующие переменные**

```typescript
// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    process.env = { ...ORIGINAL };
  });
  afterEach(() => {
    process.env = ORIGINAL;
  });

  it('throws when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    await expect(async () => {
      delete require.cache[require.resolve('../src/config.js')];
      await import('../src/config.js');
    }).rejects.toThrow(/DATABASE_URL/);
  });

  it('parses port as number', async () => {
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.PORT = '4000';
    process.env.MASTER_ENCRYPTION_KEY_BASE64 = 'a'.repeat(44);
    process.env.JWT_SECRET = 'secret';
    process.env.B24_CLIENT_ID = 'id';
    process.env.B24_CLIENT_SECRET = 'sec';
    process.env.APP_BASE_URL = 'http://localhost:3000';
    const { config } = await import('../src/config.js');
    expect(config.port).toBe(4000);
  });
});
```

- [ ] **Step 2: Реализация `src/config.ts`**

```typescript
// src/config.ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  B24_CLIENT_ID: z.string().min(1),
  B24_CLIENT_SECRET: z.string().min(1),
  MASTER_ENCRYPTION_KEY_BASE64: z.string().min(40),
  VIBECODE_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment: ${issues}`);
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  appBaseUrl: parsed.data.APP_BASE_URL,
  databaseUrl: parsed.data.DATABASE_URL,
  b24: {
    clientId: parsed.data.B24_CLIENT_ID,
    clientSecret: parsed.data.B24_CLIENT_SECRET,
  },
  masterEncryptionKeyBase64: parsed.data.MASTER_ENCRYPTION_KEY_BASE64,
  vibecodeApiKey: parsed.data.VIBECODE_API_KEY,
  jwtSecret: parsed.data.JWT_SECRET,
  logLevel: parsed.data.LOG_LEVEL,
} as const;
```

- [ ] **Step 3: Прогнать тесты**

```bash
npm test -- tests/config.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts tests/config.test.ts && git commit -m "feat(config): env-driven config with zod validation"
```

---

### Task 1.4: Криптография — sealed box обёртка

**Files:**

- Create: `src/crypto.ts`, `tests/crypto.test.ts`

- [ ] **Step 1: Тест**

```typescript
// tests/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import sodium from 'libsodium-wrappers';

beforeAll(async () => {
  await sodium.ready;
});

describe('crypto', () => {
  it('roundtrips a secret', async () => {
    process.env.MASTER_ENCRYPTION_KEY_BASE64 = sodium.to_base64(
      sodium.randombytes_buf(32),
      sodium.base64_variants.ORIGINAL,
    );
    const { encrypt, decrypt } = await import('../src/crypto.js');
    const ct = encrypt('my-imap-password');
    expect(ct).toBeInstanceOf(Buffer);
    expect(decrypt(ct)).toBe('my-imap-password');
  });

  it('fails to decrypt with wrong key', async () => {
    const { encrypt } = await import('../src/crypto.js');
    const ct = encrypt('secret');
    process.env.MASTER_ENCRYPTION_KEY_BASE64 = sodium.to_base64(
      sodium.randombytes_buf(32),
      sodium.base64_variants.ORIGINAL,
    );
    delete require.cache[require.resolve('../src/crypto.js')];
    const mod = await import('../src/crypto.js');
    expect(() => mod.decrypt(ct)).toThrow();
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/crypto.ts
import sodium from 'libsodium-wrappers';
import { config } from './config.js';

await sodium.ready;

const key = sodium.from_base64(config.masterEncryptionKeyBase64, sodium.base64_variants.ORIGINAL);
if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
  throw new Error(`MASTER_ENCRYPTION_KEY must decode to ${sodium.crypto_secretbox_KEYBYTES} bytes`);
}

export function encrypt(plaintext: string): Buffer {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ct = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, key);
  return Buffer.concat([Buffer.from(nonce), Buffer.from(ct)]);
}

export function decrypt(payload: Buffer): string {
  const nonce = payload.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
  const ct = payload.subarray(sodium.crypto_secretbox_NONCEBYTES);
  const pt = sodium.crypto_secretbox_open_easy(ct, nonce, key);
  return sodium.to_string(pt);
}
```

- [ ] **Step 3: Test, commit**

```bash
npm test -- tests/crypto.test.ts
git add src/crypto.ts tests/crypto.test.ts && git commit -m "feat(crypto): libsodium secretbox helpers"
```

---

### Task 1.5: Logger и Fastify скелет

**Files:**

- Create: `src/logger.ts`, `src/http/server.ts`, `src/main.ts`

- [ ] **Step 1: Logger**

```typescript
// src/logger.ts
import pino from 'pino';
import { config } from './config.js';
export const logger = pino({
  level: config.logLevel,
  redact: [
    '*.password',
    '*.accessToken',
    '*.refreshToken',
    '*.applicationToken',
    '*.vibecodeApiKey',
  ],
});
```

- [ ] **Step 2: Fastify factory**

```typescript
// src/http/server.ts
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { logger } from '../logger.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({ loggerInstance: logger as any, trustProxy: true });
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, { origin: true, credentials: true });
  app.get('/healthz', async () => ({ status: 'ok', ts: new Date().toISOString() }));
  return app;
}
```

- [ ] **Step 3: Entry point**

```typescript
// src/main.ts
import { buildServer } from './http/server.js';
import { config } from './config.js';
import { logger } from './logger.js';

async function main() {
  const app = buildServer();
  await app.listen({ host: '0.0.0.0', port: config.port });
  logger.info({ port: config.port }, 'server started');
}
main().catch((err) => {
  logger.fatal(err, 'startup failed');
  process.exit(1);
});
```

- [ ] **Step 4: Smoke-тест локально**

```bash
cp .env.example .env
# заполнить минимум: DATABASE_URL, MASTER_ENCRYPTION_KEY_BASE64 (sodium genkey), JWT_SECRET, B24_CLIENT_ID/SECRET, APP_BASE_URL
npm run dev
# в другом окне:
curl http://localhost:3000/healthz
```

Ожидаем: `{"status":"ok","ts":"..."}`.

- [ ] **Step 5: Commit**

```bash
git add src/logger.ts src/http/server.ts src/main.ts && git commit -m "feat(http): fastify skeleton with /healthz"
```

---

### Task 1.6: `vendor/supabase.ts` — Prisma singleton

**Files:**

- Create: `src/vendor/supabase.ts`

- [ ] **Step 1: Реализация**

```typescript
// src/vendor/supabase.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger.js';

export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

(prisma as any).$on('warn', (e: unknown) => logger.warn(e, 'prisma warn'));
(prisma as any).$on('error', (e: unknown) => logger.error(e, 'prisma error'));

export async function disconnect() {
  await prisma.$disconnect();
}
```

- [ ] **Step 2: Подключить к `/healthz`**

```typescript
// modify src/http/server.ts — расширить /healthz
import { prisma } from '../vendor/supabase.js';

app.get('/healthz', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok', db: 'up', ts: new Date().toISOString() };
});
```

- [ ] **Step 3: Запустить миграции, проверить**

```bash
npm run db:generate
npm run db:migrate
npm run dev
curl http://localhost:3000/healthz
# expect: {"status":"ok","db":"up",...}
```

- [ ] **Step 4: Commit**

```bash
git add src/vendor/supabase.ts src/http/server.ts && git commit -m "feat(db): prisma singleton + db ping in healthcheck"
```

---

### Task 1.7: `vendor/b24.ts` — клиент Б24 REST с авторизацией, retry, rate-limit

**Files:**

- Create: `src/vendor/b24.ts`, `tests/vendor/b24.test.ts`

- [ ] **Step 1: Реализация**

```typescript
// src/vendor/b24.ts
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../logger.js';

export interface B24Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface B24CallOptions {
  domain: string; // example.bitrix24.ru
  accessToken: string;
  method: string; // imconnector.register
  params?: Record<string, unknown>;
}

export class B24Error extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

const MAX_RETRIES = 3;

export async function b24Call<T = unknown>(opts: B24CallOptions): Promise<T> {
  const url = `https://${opts.domain}/rest/${opts.method}`;
  const body = new URLSearchParams({ auth: opts.accessToken });
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (typeof v === 'object') body.set(k, JSON.stringify(v));
    else body.set(k, String(v));
  }
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { method: 'POST', body });
    if (res.status === 503 || res.status === 429) {
      if (attempt === MAX_RETRIES)
        throw new B24Error(res.status, 'RATE_LIMIT', 'rate limit exceeded');
      await sleep(2 ** attempt * 1000);
      continue;
    }
    const json: any = await res.json();
    if (!res.ok || json.error) {
      throw new B24Error(
        res.status,
        json.error ?? 'UNKNOWN',
        json.error_description ?? res.statusText,
      );
    }
    return json.result as T;
  }
  throw new B24Error(500, 'EXHAUSTED', 'retries exhausted');
}

export async function refreshToken(
  domain: string,
  refresh: string,
  clientId: string,
  clientSecret: string,
): Promise<B24Tokens> {
  const url = 'https://oauth.bitrix.info/oauth/token/';
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
  });
  const res = await fetch(`${url}?${params}`);
  if (!res.ok) throw new B24Error(res.status, 'OAUTH', `refresh failed: ${await res.text()}`);
  const j: any = await res.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: new Date(Date.now() + (j.expires_in - 60) * 1000),
  };
}

export async function exchangeCode(
  domain: string,
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<B24Tokens> {
  const url = 'https://oauth.bitrix.info/oauth/token/';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });
  const res = await fetch(`${url}?${params}`);
  if (!res.ok) throw new B24Error(res.status, 'OAUTH', `code exchange failed: ${await res.text()}`);
  const j: any = await res.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: new Date(Date.now() + (j.expires_in - 60) * 1000),
  };
}
```

- [ ] **Step 2: Тест с моком fetch**

```typescript
// tests/vendor/b24.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { b24Call, B24Error } from '../../src/vendor/b24.js';

describe('b24Call', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns result on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ result: { ok: true } }),
      })),
    );
    const r = await b24Call({ domain: 'x.bitrix24.ru', accessToken: 't', method: 'app.info' });
    expect(r).toEqual({ ok: true });
  });

  it('throws B24Error on api error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'INVALID_TOKEN', error_description: 'bad' }),
      })),
    );
    await expect(b24Call({ domain: 'x', accessToken: 't', method: 'm' })).rejects.toBeInstanceOf(
      B24Error,
    );
  });

  it('retries on 503', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++;
        if (calls < 2) return { ok: false, status: 503, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ result: 'ok' }) };
      }),
    );
    const r = await b24Call({ domain: 'x', accessToken: 't', method: 'm' });
    expect(r).toBe('ok');
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 3: Run, commit**

```bash
npm test -- tests/vendor/b24.test.ts
git add src/vendor/b24.ts tests/vendor/b24.test.ts && git commit -m "feat(vendor/b24): rest client with oauth refresh + retries"
```

---

### Task 1.8: OAuth установка — endpoint и InstallFlow

**Files:**

- Create: `src/http/routes/oauth.ts`, `src/domain/portal/InstallFlow.ts`, `tests/domain/portal/InstallFlow.test.ts`

- [ ] **Step 1: InstallFlow с тестом**

```typescript
// tests/domain/portal/InstallFlow.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleInstall } from '../../../src/domain/portal/InstallFlow.js';

describe('InstallFlow.handleInstall', () => {
  it('upserts portal with encrypted tokens', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'p1' });
    const exchange = vi.fn().mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const encrypt = vi.fn((s: string) => Buffer.from(`enc:${s}`));
    const result = await handleInstall(
      { code: 'C', domain: 'x.bitrix24.ru', memberId: 'M1', applicationToken: 'AT' },
      { upsertPortal: upsert, exchangeCode: exchange, encrypt },
    );
    expect(result.portalId).toBe('p1');
    expect(exchange).toHaveBeenCalledWith('x.bitrix24.ru', 'C');
    const arg = upsert.mock.calls[0][0];
    expect(arg.b24MemberId).toBe('M1');
    expect(arg.accessToken).toEqual(Buffer.from('enc:at'));
    expect(arg.applicationToken).toEqual(Buffer.from('enc:AT'));
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/domain/portal/InstallFlow.ts
export interface InstallInput {
  code: string;
  domain: string;
  memberId: string;
  applicationToken?: string;
}
export interface InstallDeps {
  upsertPortal: (data: {
    b24MemberId: string;
    domain: string;
    accessToken: Buffer;
    refreshToken: Buffer;
    tokenExpiresAt: Date;
    applicationToken: Buffer | null;
  }) => Promise<{ id: string }>;
  exchangeCode: (
    domain: string,
    code: string,
  ) => Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }>;
  encrypt: (s: string) => Buffer;
}

export async function handleInstall(input: InstallInput, deps: InstallDeps) {
  const tokens = await deps.exchangeCode(input.domain, input.code);
  const portal = await deps.upsertPortal({
    b24MemberId: input.memberId,
    domain: input.domain,
    accessToken: deps.encrypt(tokens.accessToken),
    refreshToken: deps.encrypt(tokens.refreshToken),
    tokenExpiresAt: tokens.expiresAt,
    applicationToken: input.applicationToken ? deps.encrypt(input.applicationToken) : null,
  });
  return { portalId: portal.id };
}
```

- [ ] **Step 3: Эндпоинт `/oauth/install`**

```typescript
// src/http/routes/oauth.ts
import { FastifyInstance } from 'fastify';
import { handleInstall } from '../../domain/portal/InstallFlow.js';
import { exchangeCode } from '../../vendor/b24.js';
import { prisma } from '../../vendor/supabase.js';
import { encrypt } from '../../crypto.js';
import { config } from '../../config.js';

export async function oauthRoutes(app: FastifyInstance) {
  app.post('/oauth/install', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const { AUTH_ID, REFRESH_ID, DOMAIN, member_id, APP_SID, application_token } = body;
    if (!AUTH_ID || !DOMAIN || !member_id) return reply.code(400).send({ error: 'missing fields' });

    const { portalId } = await handleInstall(
      {
        code: '',
        domain: DOMAIN,
        memberId: member_id,
        applicationToken: application_token,
      },
      {
        upsertPortal: async (d) =>
          prisma.portal.upsert({
            where: { b24MemberId: d.b24MemberId },
            create: d,
            update: { ...d, uninstalledAt: null },
          }),
        exchangeCode: async () => ({
          accessToken: AUTH_ID,
          refreshToken: REFRESH_ID,
          expiresAt: new Date(Date.now() + (parseInt(body.AUTH_EXPIRES) - 60) * 1000),
        }),
        encrypt,
      },
    );
    reply.header('Content-Type', 'text/html');
    return `<script>window.parent.postMessage({type:'installed',portalId:'${portalId}'},'*');</script>`;
  });
}
```

Примечание: Б24 при placement-handler установки передаёт уже выпущенный AUTH_ID/REFRESH_ID, поэтому отдельный code-обмен не нужен. Для случая, когда требуется именно OAuth-обмен (вход через oauth.bitrix.info) — отдельный эндпоинт `/oauth/callback` добавляется аналогично, используя `exchangeCode` из `vendor/b24.ts`.

- [ ] **Step 4: Зарегистрировать роуты, протестировать локально**

```typescript
// src/http/server.ts
import { oauthRoutes } from './routes/oauth.js';
// в buildServer:
app.register(oauthRoutes);
```

- [ ] **Step 5: Run, commit**

```bash
npm test
git add src/domain/portal/InstallFlow.ts src/http/routes/oauth.ts tests/domain/portal/InstallFlow.test.ts src/http/server.ts
git commit -m "feat(oauth): portal install endpoint with token storage"
```

---

### Task 1.9: Token refresher worker

**Files:**

- Create: `src/workers/tokenRefresher.ts`, `tests/workers/tokenRefresher.test.ts`

- [ ] **Step 1: Реализация и тест (как и ранее: TDD)**

```typescript
// src/workers/tokenRefresher.ts
import { prisma } from '../vendor/supabase.js';
import { refreshToken } from '../vendor/b24.js';
import { encrypt, decrypt } from '../crypto.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const TICK_MS = 30 * 60 * 1000;

export async function refreshExpiringTokens(now = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() + 10 * 60 * 1000);
  const expiring = await prisma.portal.findMany({
    where: { tokenExpiresAt: { lt: threshold }, uninstalledAt: null },
  });
  let ok = 0;
  for (const p of expiring) {
    try {
      const refresh = decrypt(p.refreshToken);
      const tokens = await refreshToken(
        p.domain,
        refresh,
        config.b24.clientId,
        config.b24.clientSecret,
      );
      await prisma.portal.update({
        where: { id: p.id },
        data: {
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
        },
      });
      ok++;
    } catch (e) {
      logger.error({ err: e, portalId: p.id }, 'token refresh failed');
    }
  }
  return ok;
}

export function startTokenRefresher() {
  const tick = async () => {
    try {
      await refreshExpiringTokens();
    } catch (e) {
      logger.error(e, 'tokenRefresher tick failed');
    }
  };
  void tick();
  return setInterval(tick, TICK_MS);
}
```

- [ ] **Step 2: Тест с моком Prisma**

```typescript
// tests/workers/tokenRefresher.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/vendor/supabase.js', () => ({
  prisma: {
    portal: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'p1',
          domain: 'x.bitrix24.ru',
          refreshToken: Buffer.from([]),
          accessToken: Buffer.from([]),
          tokenExpiresAt: new Date(),
        },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));
vi.mock('../../src/vendor/b24.js', () => ({
  refreshToken: vi.fn().mockResolvedValue({
    accessToken: 'new',
    refreshToken: 'newR',
    expiresAt: new Date(Date.now() + 3600_000),
  }),
}));
vi.mock('../../src/crypto.js', () => ({
  encrypt: (s: string) => Buffer.from(`enc:${s}`),
  decrypt: (_b: Buffer) => 'OLD_REFRESH',
}));

import { refreshExpiringTokens } from '../../src/workers/tokenRefresher.js';

describe('refreshExpiringTokens', () => {
  it('refreshes and updates expiring portals', async () => {
    const ok = await refreshExpiringTokens();
    expect(ok).toBe(1);
  });
});
```

- [ ] **Step 3: Подключить к main.ts**

```typescript
// src/main.ts
import { startTokenRefresher } from './workers/tokenRefresher.js';
// после listen:
const tokenTimer = startTokenRefresher();
process.on('SIGTERM', () => {
  clearInterval(tokenTimer);
});
```

- [ ] **Step 4: Commit**

```bash
npm test
git add src/workers/tokenRefresher.ts tests/workers/tokenRefresher.test.ts src/main.ts
git commit -m "feat(workers): token refresher loop every 30m"
```

---

### Task 1.10: JWT для frontend (iframe-auth)

**Files:**

- Create: `src/http/auth.ts`, `src/http/routes/api.ts`, `tests/http/auth.test.ts`

- [ ] **Step 1: Реализация**

```typescript
// src/http/auth.ts
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { b24Call } from '../vendor/b24.js';
import { prisma } from '../vendor/supabase.js';
import { decrypt } from '../crypto.js';

export interface SessionToken {
  portalId: string;
  b24UserId: number;
  domain: string;
}

export async function validateB24IframeAuth(
  authId: string,
  memberId: string,
  domain: string,
): Promise<SessionToken> {
  const info = await b24Call<{ ID: number }>({
    domain,
    accessToken: authId,
    method: 'user.current',
  });
  const portal = await prisma.portal.findUniqueOrThrow({ where: { b24MemberId: memberId } });
  return { portalId: portal.id, b24UserId: info.ID, domain };
}

export function issueJwt(s: SessionToken): string {
  return jwt.sign(s, config.jwtSecret, { expiresIn: '15m' });
}
export function verifyJwt(token: string): SessionToken {
  return jwt.verify(token, config.jwtSecret) as SessionToken;
}
```

- [ ] **Step 2: API роут `/api/session`**

```typescript
// src/http/routes/api.ts
import { FastifyInstance } from 'fastify';
import { issueJwt, validateB24IframeAuth, verifyJwt } from '../auth.js';

export async function apiRoutes(app: FastifyInstance) {
  app.post('/api/session', async (req, reply) => {
    const { AUTH_ID, member_id, DOMAIN } = req.body as Record<string, string>;
    if (!AUTH_ID || !member_id || !DOMAIN) return reply.code(400).send({ error: 'missing fields' });
    try {
      const s = await validateB24IframeAuth(AUTH_ID, member_id, DOMAIN);
      return { token: issueJwt(s), expiresIn: 900 };
    } catch (e: any) {
      return reply.code(401).send({ error: 'invalid b24 auth', detail: e.message });
    }
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url === '/api/session') return;
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return reply.code(401).send({ error: 'unauthorized' });
    try {
      (req as any).session = verifyJwt(h.slice(7));
    } catch {
      return reply.code(401).send({ error: 'invalid token' });
    }
  });
}
```

- [ ] **Step 3: Зарегистрировать**

```typescript
// src/http/server.ts
import { apiRoutes } from './routes/api.js';
app.register(apiRoutes);
```

- [ ] **Step 4: Тест auth.ts с моком Б24**

```typescript
// tests/http/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
process.env.JWT_SECRET = 'test-secret-min-16-chars';
// + остальные env

vi.mock('../../src/vendor/b24.js', () => ({
  b24Call: vi.fn().mockResolvedValue({ ID: 42 }),
}));
vi.mock('../../src/vendor/supabase.js', () => ({
  prisma: { portal: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'p1' }) } },
}));

import { validateB24IframeAuth, issueJwt, verifyJwt } from '../../src/http/auth.js';

describe('jwt', () => {
  it('issues and verifies token', async () => {
    const s = await validateB24IframeAuth('AUTH', 'M', 'x.bitrix24.ru');
    expect(s.b24UserId).toBe(42);
    const tok = issueJwt(s);
    expect(verifyJwt(tok)).toMatchObject({ portalId: 'p1' });
  });
});
```

- [ ] **Step 5: Run, commit**

```bash
npm test
git add src/http/auth.ts src/http/routes/api.ts tests/http/auth.test.ts src/http/server.ts
git commit -m "feat(auth): jwt session for spa with b24 iframe validation"
```

---

### Task 1.11: Деплой первой версии на VibeCode + smoke

**Files:**

- Create: `scripts/deploy-vibecode.ts`

- [ ] **Step 1: Скрипт деплоя**

```typescript
// scripts/deploy-vibecode.ts
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const apiKey = process.env.VIBECODE_API_KEY;
const serverId = process.env.VIBECODE_SERVER_ID;
if (!apiKey || !serverId) {
  console.error('VIBECODE_API_KEY and VIBECODE_SERVER_ID required');
  process.exit(1);
}

execSync('tar --exclude=node_modules --exclude=dist --exclude=.git -czf /tmp/commhub.tar.gz .', {
  stdio: 'inherit',
});

const form = new FormData();
form.append('source', new Blob([readFileSync('/tmp/commhub.tar.gz')]), 'commhub.tar.gz');
form.append('install', 'npm ci && npx prisma generate && npm run build');
form.append('start', 'npm run db:migrate && npm start');
form.append('port', '3000');

const res = await fetch(`https://vibecode.bitrix24.tech/v1/infra/servers/${serverId}/deploy`, {
  method: 'POST',
  body: form,
  headers: { 'X-Api-Key': apiKey },
});
if (!res.ok) {
  console.error('deploy failed:', res.status, await res.text());
  process.exit(1);
}
console.log('deployed:', await res.text());
```

- [ ] **Step 2: Создать prod VibeCode-сервер, передать env**

```bash
# создать сервер по аналогии с T0.3
# через PATCH /v1/infra/servers/{id}/env передать DATABASE_URL, B24_CLIENT_ID и т.д.
```

- [ ] **Step 3: Деплой и smoke**

```bash
VIBECODE_API_KEY=... VIBECODE_SERVER_ID=... npx tsx scripts/deploy-vibecode.ts
curl https://app-PROD.vibecode.bitrix24.tech/healthz
```

- [ ] **Step 4: Установить приложение на тестовый портал, проверить запись в `portals`**

Открыть Маркет → Локальное приложение → установить. После установки в Supabase Studio проверить:

```sql
SELECT b24_member_id, domain, installed_at FROM portals;
```

- [ ] **Step 5: Commit, тэг**

```bash
git add scripts/ && git commit -m "feat(deploy): vibecode infra deploy script"
git tag sprint-1-complete
```

---

# СПРИНТ 2 — Email Connector (7 дней)

**Цель:** Полный двусторонний поток email через Custom Connector OL.

**DoD:** Письмо извне попадает в OL и нашу БД ≤ 90 сек; ответ оператора через стандартный OL приходит клиенту на email ≤ 30 сек; In-Reply-To корректен.

---

### Task 2.1: Регистрация коннектора в Open Lines

**Files:**

- Create: `src/domain/connector/ConnectorRegistration.ts`, `tests/domain/connector/ConnectorRegistration.test.ts`

- [ ] **Step 1: Тест**

```typescript
// tests/domain/connector/ConnectorRegistration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { registerEmailConnector } from '../../../src/domain/connector/ConnectorRegistration.js';

describe('registerEmailConnector', () => {
  it('calls imconnector.register with expected fields', async () => {
    const call = vi.fn().mockResolvedValue(true);
    await registerEmailConnector({ domain: 'x', accessToken: 't' }, { b24Call: call });
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'imconnector.register',
        params: expect.objectContaining({
          CONNECTOR: { ID: expect.stringMatching(/comm_hub_email/), NAME: expect.any(String) },
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/domain/connector/ConnectorRegistration.ts
export const CONNECTOR_ID = 'comm_hub_email';

export interface RegisterDeps {
  b24Call: (opts: {
    domain: string;
    accessToken: string;
    method: string;
    params: any;
  }) => Promise<unknown>;
}
export interface Ctx {
  domain: string;
  accessToken: string;
}

export async function registerEmailConnector(ctx: Ctx, deps: RegisterDeps) {
  return deps.b24Call({
    domain: ctx.domain,
    accessToken: ctx.accessToken,
    method: 'imconnector.register',
    params: {
      CONNECTOR: {
        ID: CONNECTOR_ID,
        NAME: 'Email (Центр коммуникаций)',
        ICON: { color: '#1e88e5', text: 'E' },
        ICON_DISABLED: { color: '#9e9e9e', text: 'E' },
        COMPONENT: '',
      },
    },
  });
}

export async function activateConnector(ctx: Ctx, deps: RegisterDeps, lineId: number) {
  return deps.b24Call({
    domain: ctx.domain,
    accessToken: ctx.accessToken,
    method: 'imconnector.activate',
    params: { CONNECTOR: CONNECTOR_ID, LINE: lineId, ACTIVE: 1 },
  });
}

export async function setConnectorData(
  ctx: Ctx,
  deps: RegisterDeps,
  lineId: number,
  data: Record<string, unknown>,
) {
  return deps.b24Call({
    domain: ctx.domain,
    accessToken: ctx.accessToken,
    method: 'imconnector.connector.data.set',
    params: { CONNECTOR: CONNECTOR_ID, LINE: lineId, DATA: data },
  });
}
```

- [ ] **Step 3: Зарегистрировать коннектор в момент OAuth-install**

```typescript
// дополнить src/domain/portal/InstallFlow.ts — после upsert вызывать registerEmailConnector
// (или сделать это позднее, при подключении ящика — оставим на T2.2 для chain-of-responsibility)
```

- [ ] **Step 4: Run, commit**

```bash
npm test
git add src/domain/connector/ tests/domain/connector/
git commit -m "feat(connector): email custom connector registration"
```

---

### Task 2.2: Endpoint подключения почтового ящика

**Files:**

- Create: `src/http/routes/mailbox.ts`, `tests/http/mailbox.test.ts`

- [ ] **Step 1: Реализация endpoint'ов CRUD ящика**

```typescript
// src/http/routes/mailbox.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { prisma } from '../../vendor/supabase.js';
import { encrypt, decrypt } from '../../crypto.js';
import { b24Call } from '../../vendor/b24.js';
import {
  activateConnector,
  registerEmailConnector,
} from '../../domain/connector/ConnectorRegistration.js';

const MailboxBody = z.object({
  email: z.string().email(),
  imapHost: z.string(),
  imapPort: z.number().int(),
  imapUser: z.string(),
  imapPassword: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpUser: z.string(),
  smtpPassword: z.string(),
  useSsl: z.boolean().default(true),
  olLineId: z.number().int(),
});

export async function mailboxRoutes(app: FastifyInstance) {
  app.get('/api/mailbox', async (req) => {
    const { portalId } = (req as any).session;
    const m = await prisma.mailbox.findUnique({ where: { portalId } });
    if (!m) return null;
    return {
      id: m.id,
      email: m.email,
      imapHost: m.imapHost,
      smtpHost: m.smtpHost,
      olLineId: m.olLineId,
      enabled: m.enabled,
      lastError: m.lastError,
    };
  });

  app.post('/api/mailbox', async (req, reply) => {
    const { portalId } = (req as any).session;
    const body = MailboxBody.parse(req.body);
    const portal = await prisma.portal.findUniqueOrThrow({ where: { id: portalId } });
    const accessToken = decrypt(portal.accessToken);

    // 1. Проверить, что ящик не подключён к штатному email-tracker
    try {
      const existing = await b24Call<any[]>({
        domain: portal.domain,
        accessToken,
        method: 'mailservice.mailbox.list',
        params: {},
      });
      if (Array.isArray(existing) && existing.some((mb: any) => mb.EMAIL === body.email)) {
        return reply.code(409).send({
          error: 'mailbox_in_native_tracker',
          message: `Ящик ${body.email} уже подключён к штатному email-tracker Б24. Отключите его в разделе Контакт-центр → Почта.`,
        });
      }
    } catch {
      /* mailservice.mailbox.list может отсутствовать на коробке — игнорируем */
    }

    // 2. Проверить IMAP
    const imap = new ImapFlow({
      host: body.imapHost,
      port: body.imapPort,
      secure: body.useSsl,
      auth: { user: body.imapUser, pass: body.imapPassword },
      logger: false,
    });
    try {
      await imap.connect();
      await imap.logout();
    } catch (e: any) {
      return reply.code(400).send({ error: 'imap_connect_failed', detail: e.message });
    }

    // 3. Проверить SMTP
    const smtp = nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort,
      secure: body.useSsl,
      auth: { user: body.smtpUser, pass: body.smtpPassword },
    });
    try {
      await smtp.verify();
    } catch (e: any) {
      return reply.code(400).send({ error: 'smtp_connect_failed', detail: e.message });
    }

    // 4. Зарегистрировать коннектор (idempotent) и активировать на линии
    await registerEmailConnector({ domain: portal.domain, accessToken }, { b24Call });
    await activateConnector({ domain: portal.domain, accessToken }, { b24Call }, body.olLineId);

    // 5. Сохранить ящик
    const mailbox = await prisma.mailbox.upsert({
      where: { portalId },
      create: {
        portalId,
        email: body.email,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUser: body.imapUser,
        imapPassword: encrypt(body.imapPassword),
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPassword: encrypt(body.smtpPassword),
        useSsl: body.useSsl,
        olConnectorId: 'comm_hub_email',
        olLineId: body.olLineId,
      },
      update: {
        email: body.email,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUser: body.imapUser,
        imapPassword: encrypt(body.imapPassword),
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPassword: encrypt(body.smtpPassword),
        useSsl: body.useSsl,
        olLineId: body.olLineId,
        enabled: true,
        lastError: null,
      },
    });
    return { id: mailbox.id, email: mailbox.email };
  });

  app.delete('/api/mailbox', async (req) => {
    const { portalId } = (req as any).session;
    await prisma.mailbox.deleteMany({ where: { portalId } });
    return { ok: true };
  });
}
```

- [ ] **Step 2: Подключить, протестировать unit-тестом для валидации**

```typescript
// tests/http/mailbox.test.ts — проверка zod-схемы и контракта endpoint'а через app.inject
// (использовать fastify-injection без реальной сети)
```

- [ ] **Step 3: Commit**

```bash
git add src/http/routes/mailbox.ts tests/http/mailbox.test.ts src/http/server.ts
git commit -m "feat(mailbox): connect mailbox endpoint with imap/smtp validation"
```

---

### Task 2.3: EmailParser — обрезка цитат, HTML→plain

**Files:**

- Create: `src/domain/email/EmailParser.ts`, `tests/domain/email/EmailParser.test.ts`

- [ ] **Step 1: Тесты с реальными примерами**

```typescript
// tests/domain/email/EmailParser.test.ts
import { describe, it, expect } from 'vitest';
import { trimQuoted, htmlToPlain } from '../../../src/domain/email/EmailParser.js';

describe('trimQuoted', () => {
  it('removes Gmail-style quoted text', () => {
    const input = `Привет, спасибо за ответ!

On Mon, May 12, 2026 at 3:45 PM Иванов <ivan@x.ru> wrote:
> Здравствуйте, у меня вопрос...
> Подскажите по тарифам.

С уважением,
Пётр`;
    const out = trimQuoted(input);
    expect(out).toContain('Привет');
    expect(out).not.toContain('On Mon');
    expect(out).not.toContain('> Здравствуйте');
  });

  it('removes Outlook-style quote header', () => {
    const input = `Спасибо!

From: ivan@x.ru
Sent: Monday, May 12
To: support@y.ru
Subject: Re: Вопрос

Здравствуйте...`;
    expect(trimQuoted(input)).toBe('Спасибо!');
  });

  it('removes signature after standalone "-- "', () => {
    const input = `Ответ.\n-- \nПётр\nДиректор`;
    expect(trimQuoted(input)).toBe('Ответ.');
  });

  it('returns original when no quote markers', () => {
    expect(trimQuoted('Просто текст')).toBe('Просто текст');
  });
});

describe('htmlToPlain', () => {
  it('preserves paragraph breaks', () => {
    expect(htmlToPlain('<p>Hello</p><p>World</p>')).toBe('Hello\n\nWorld');
  });
  it('strips inline styles', () => {
    expect(htmlToPlain('<p style="color:red">Hi</p>')).toBe('Hi');
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/domain/email/EmailParser.ts
import { convert } from 'html-to-text';

const QUOTE_PATTERNS = [/^On .+ wrote:$/m, /^В .+ написал[а]?:$/m, /^From: .+$/m, /^От: .+$/m];

export function trimQuoted(text: string): string {
  let cut = text.length;
  for (const p of QUOTE_PATTERNS) {
    const m = text.match(p);
    if (m && m.index !== undefined && m.index < cut) cut = m.index;
  }
  let result = text.slice(0, cut);
  const sigIdx = result.indexOf('\n-- \n');
  if (sigIdx > -1) result = result.slice(0, sigIdx);
  return result.trim();
}

export function htmlToPlain(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [{ selector: 'a', options: { ignoreHref: true } }],
  }).trim();
}

export interface ParsedAddress {
  email: string;
  name?: string;
}
export function parseAddress(raw: string): ParsedAddress {
  const m = raw.match(/^\s*(?:"?([^"<]+)"?\s)?<?([^\s<>]+@[^\s<>]+)>?\s*$/);
  if (!m) return { email: raw.trim() };
  return { email: m[2]!.trim().toLowerCase(), name: m[1]?.trim() };
}
```

- [ ] **Step 3: Установить `html-to-text`**

```bash
npm install html-to-text @types/html-to-text
```

- [ ] **Step 4: Run, commit**

```bash
npm test -- tests/domain/email
git add src/domain/email tests/domain/email package.json package-lock.json
git commit -m "feat(email): parser for quoted-text trim and html→plain"
```

---

### Task 2.4: MessageBridge — мост email ↔ OL

**Files:**

- Create: `src/domain/connector/MessageBridge.ts`, `tests/domain/connector/MessageBridge.test.ts`

- [ ] **Step 1: Тест с моками**

```typescript
// tests/domain/connector/MessageBridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import { pushIncomingToOL } from '../../../src/domain/connector/MessageBridge.js';

describe('pushIncomingToOL', () => {
  it('forwards parsed email to imconnector.send.messages', async () => {
    const b24Call = vi.fn().mockResolvedValue([{ chat: { id: 100 }, message: { id: 200 } }]);
    const result = await pushIncomingToOL(
      {
        portal: { domain: 'x', accessToken: 't' },
        mailbox: { email: 'support@y.ru', olLineId: 7 },
        from: { email: 'ivan@x.ru', name: 'Иванов' },
        subject: 'Привет',
        text: 'Привет, у меня вопрос',
        messageId: '<abc@x.ru>',
        attachments: [],
      },
      { b24Call },
    );
    expect(result).toEqual({ olChatId: 100, olMessageId: 200 });
    const callArg = b24Call.mock.calls[0][0];
    expect(callArg.method).toBe('imconnector.send.messages');
    expect(callArg.params.MESSAGES[0].message.text).toContain('Привет, у меня вопрос');
    expect(callArg.params.MESSAGES[0].user.id).toBe('ivan@x.ru');
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/domain/connector/MessageBridge.ts
import { CONNECTOR_ID } from './ConnectorRegistration.js';

export interface IncomingEmail {
  portal: { domain: string; accessToken: string };
  mailbox: { email: string; olLineId: number };
  from: { email: string; name?: string };
  subject?: string;
  text: string;
  messageId: string;
  attachments: { name: string; data: Buffer; mime: string }[];
}
export interface BridgeDeps {
  b24Call: (opts: {
    domain: string;
    accessToken: string;
    method: string;
    params: any;
  }) => Promise<any>;
}

export async function pushIncomingToOL(
  input: IncomingEmail,
  deps: BridgeDeps,
): Promise<{ olChatId: number; olMessageId: number }> {
  const text = input.subject ? `📧 ${input.subject}\n\n${input.text}` : input.text;
  const truncated =
    text.length > 100_000 ? `${text.slice(0, 100_000)}\n[...сообщение обрезано]` : text;
  const result = await deps.b24Call({
    domain: input.portal.domain,
    accessToken: input.portal.accessToken,
    method: 'imconnector.send.messages',
    params: {
      CONNECTOR: CONNECTOR_ID,
      LINE: input.mailbox.olLineId,
      MESSAGES: [
        {
          user: {
            id: input.from.email,
            last_name: input.from.name ?? '',
            name: input.from.email,
            email: input.from.email,
          },
          message: {
            id: input.messageId,
            date: Math.floor(Date.now() / 1000),
            text: truncated,
          },
          chat: { id: input.from.email, name: input.from.email },
        },
      ],
    },
  });
  // imconnector.send.messages → массив с {chat:{id}, message:{id}}
  const r = Array.isArray(result) ? result[0] : result;
  return {
    olChatId: Number(r?.chat?.id ?? r?.CHAT_ID),
    olMessageId: Number(r?.message?.id ?? r?.MESSAGE_ID),
  };
}

export interface OutgoingEmail {
  portal: { domain: string; accessToken: string };
  mailbox: {
    email: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    useSsl: boolean;
  };
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
  attachments: { filename: string; content: Buffer; contentType: string }[];
}
```

- [ ] **Step 3: Run, commit**

```bash
npm test -- tests/domain/connector
git add src/domain/connector tests/domain/connector
git commit -m "feat(connector): incoming email → OL bridge with truncation"
```

---

### Task 2.5: IMAP poller worker

**Files:**

- Create: `src/workers/imapPoller.ts`, `src/domain/email/IncomingEmailHandler.ts`, `tests/workers/imapPoller.test.ts`

- [ ] **Step 1: IncomingEmailHandler — orchestrator**

```typescript
// src/domain/email/IncomingEmailHandler.ts
import { parseAddress, trimQuoted, htmlToPlain } from './EmailParser.js';
import { pushIncomingToOL } from '../connector/MessageBridge.js';
import type { ParsedMail } from 'mailparser';
import type { BridgeDeps } from '../connector/MessageBridge.js';

export interface HandlerCtx {
  portal: { domain: string; accessToken: string };
  mailbox: { id: string; email: string; olLineId: number };
}
export interface HandlerDeps extends BridgeDeps {
  recordMap: (rec: {
    mailboxId: string;
    emailMessageId: string;
    emailInReplyTo: string | null;
    olChatId: bigint;
    olMessageId: bigint;
    direction: 'inbound';
  }) => Promise<void>;
}

export async function handleIncomingEmail(
  ctx: HandlerCtx,
  parsed: ParsedMail,
  deps: HandlerDeps,
): Promise<void> {
  const fromRaw = parsed.from?.value?.[0];
  if (!fromRaw?.address) return;
  const from = { email: fromRaw.address.toLowerCase(), name: fromRaw.name };

  const html = parsed.html ? htmlToPlain(parsed.html) : null;
  const rawText = parsed.text ?? html ?? '';
  const text = trimQuoted(rawText);
  if (!text.trim() && !parsed.attachments?.length) return;

  const messageId = parsed.messageId ?? `gen-${Date.now()}@commhub`;
  const inReplyTo = parsed.inReplyTo ?? null;

  const { olChatId, olMessageId } = await pushIncomingToOL(
    {
      portal: ctx.portal,
      mailbox: { email: ctx.mailbox.email, olLineId: ctx.mailbox.olLineId },
      from,
      subject: parsed.subject,
      text,
      messageId,
      attachments: [],
    },
    deps,
  );

  await deps.recordMap({
    mailboxId: ctx.mailbox.id,
    emailMessageId: messageId,
    emailInReplyTo: inReplyTo,
    olChatId: BigInt(olChatId),
    olMessageId: BigInt(olMessageId),
    direction: 'inbound',
  });
}
```

- [ ] **Step 2: IMAP poller**

```typescript
// src/workers/imapPoller.ts
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../vendor/supabase.js';
import { decrypt } from '../crypto.js';
import { b24Call } from '../vendor/b24.js';
import { handleIncomingEmail } from '../domain/email/IncomingEmailHandler.js';
import { logger } from '../logger.js';

const POLL_INTERVAL_MS = 60_000;
const FAILURES_BEFORE_DISABLE = 5;
const failureCounts = new Map<string, number>();

export async function pollOnce(mailboxId: string): Promise<void> {
  const mb = await prisma.mailbox.findUniqueOrThrow({
    where: { id: mailboxId },
    include: { portal: true },
  });
  if (!mb.enabled || mb.portal.uninstalledAt) return;
  const log = logger.child({ mailboxId, email: mb.email });

  const client = new ImapFlow({
    host: mb.imapHost,
    port: mb.imapPort,
    secure: mb.useSsl,
    auth: { user: mb.imapUser, pass: decrypt(mb.imapPassword) },
    logger: false,
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = mb.lastSeenUid ?? 0;
      const range = since > 0 ? `${since + 1}:*` : '1:*';
      const fetcher = client.fetch(range, { uid: true, source: true });
      let maxUid = since;
      for await (const msg of fetcher) {
        if (msg.uid <= since) continue;
        const parsed = await simpleParser(msg.source as Buffer);
        await handleIncomingEmail(
          {
            portal: { domain: mb.portal.domain, accessToken: decrypt(mb.portal.accessToken) },
            mailbox: { id: mb.id, email: mb.email, olLineId: mb.olLineId },
          },
          parsed,
          {
            b24Call,
            recordMap: async (rec) => {
              await prisma.emailMessageMap.create({
                data: { ...rec, status: 'sent', sentAt: new Date() },
              });
            },
          },
        );
        if (msg.uid > maxUid) maxUid = msg.uid;
      }
      await prisma.mailbox.update({
        where: { id: mb.id },
        data: { lastSeenUid: maxUid, lastPolledAt: new Date(), lastError: null },
      });
      failureCounts.set(mb.id, 0);
    } finally {
      lock.release();
    }
  } catch (e: any) {
    log.error(e, 'imap poll failed');
    const c = (failureCounts.get(mb.id) ?? 0) + 1;
    failureCounts.set(mb.id, c);
    await prisma.mailbox.update({
      where: { id: mb.id },
      data: { lastError: e.message, enabled: c < FAILURES_BEFORE_DISABLE },
    });
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

export function startImapPoller() {
  return setInterval(async () => {
    const boxes = await prisma.mailbox.findMany({ where: { enabled: true } });
    await Promise.allSettled(boxes.map((mb) => pollOnce(mb.id)));
  }, POLL_INTERVAL_MS);
}
```

- [ ] **Step 3: Подключить в main.ts**

```typescript
// src/main.ts
import { startImapPoller } from './workers/imapPoller.js';
// после listen:
const imapTimer = startImapPoller();
process.on('SIGTERM', () => {
  clearInterval(imapTimer);
});
```

- [ ] **Step 4: Тест handler'а**

```typescript
// tests/domain/email/IncomingEmailHandler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleIncomingEmail } from '../../../src/domain/email/IncomingEmailHandler.js';

describe('handleIncomingEmail', () => {
  it('parses, trims, and pushes to OL', async () => {
    const b24Call = vi.fn().mockResolvedValue([{ chat: { id: 1 }, message: { id: 2 } }]);
    const recordMap = vi.fn();
    await handleIncomingEmail(
      {
        portal: { domain: 'x', accessToken: 't' },
        mailbox: { id: 'm1', email: 's@y.ru', olLineId: 1 },
      },
      {
        from: { value: [{ address: 'ivan@x.ru', name: 'Иванов' }] } as any,
        subject: 'Test',
        text: 'Привет\n\nOn date wrote:\n> old',
        messageId: '<id1@x>',
      } as any,
      { b24Call, recordMap },
    );
    expect(b24Call).toHaveBeenCalledOnce();
    expect(recordMap).toHaveBeenCalledWith(
      expect.objectContaining({
        emailMessageId: '<id1@x>',
        direction: 'inbound',
      }),
    );
  });
});
```

- [ ] **Step 5: Run, commit**

```bash
npm test
git add src/workers/imapPoller.ts src/domain/email/IncomingEmailHandler.ts tests/domain/email/IncomingEmailHandler.test.ts src/main.ts
git commit -m "feat(workers): imap poller with handler for incoming email"
```

---

### Task 2.6: Webhook receiver — `OnImConnectorMessageAdd`

**Files:**

- Create: `src/http/routes/webhooks.ts`, `src/domain/email/OutgoingEmailHandler.ts`

- [ ] **Step 1: Тест handler'а исходящих**

```typescript
// tests/domain/email/OutgoingEmailHandler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleOutgoingFromOL } from '../../../src/domain/email/OutgoingEmailHandler.js';

describe('handleOutgoingFromOL', () => {
  it('builds reply with In-Reply-To from previous inbound', async () => {
    const findMap = vi.fn().mockResolvedValue({
      emailMessageId: '<inbound@x>',
      direction: 'inbound',
    });
    const enqueue = vi.fn();
    await handleOutgoingFromOL(
      {
        olChatId: 100n,
        text: 'Ответ оператора',
        clientEmail: 'ivan@x.ru',
        mailbox: {
          email: 's@y.ru',
          smtpHost: 'h',
          smtpPort: 465,
          smtpUser: 'u',
          smtpPassword: 'p',
          useSsl: true,
        },
        subject: 'Re: Test',
      },
      { findLastInboundMap: findMap, enqueueSmtp: enqueue, recordMap: vi.fn() },
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ivan@x.ru',
        text: 'Ответ оператора',
        inReplyTo: '<inbound@x>',
      }),
    );
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/domain/email/OutgoingEmailHandler.ts
export interface OutgoingInput {
  olChatId: bigint;
  text: string;
  clientEmail: string;
  subject: string;
  mailbox: {
    email: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    useSsl: boolean;
  };
}
export interface SmtpJob {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
  smtp: { host: string; port: number; user: string; password: string; secure: boolean };
  mailboxId: string;
  emailMessageId: string;
}
export interface OutgoingDeps {
  findLastInboundMap: (olChatId: bigint) => Promise<{ emailMessageId: string } | null>;
  enqueueSmtp: (job: SmtpJob & { mailboxId: string }) => Promise<void>;
  recordMap: (rec: any) => Promise<void>;
}

export async function handleOutgoingFromOL(
  input: OutgoingInput & { mailboxId?: string },
  deps: OutgoingDeps,
) {
  const last = await deps.findLastInboundMap(input.olChatId);
  const newId = `<commhub-${Date.now()}-${Math.random().toString(36).slice(2)}@commhub>`;
  await deps.enqueueSmtp({
    from: input.mailbox.email,
    to: input.clientEmail,
    subject: input.subject || 'Сообщение',
    text: input.text,
    inReplyTo: last?.emailMessageId,
    references: last ? [last.emailMessageId] : undefined,
    smtp: {
      host: input.mailbox.smtpHost,
      port: input.mailbox.smtpPort,
      user: input.mailbox.smtpUser,
      password: input.mailbox.smtpPassword,
      secure: input.mailbox.useSsl,
    },
    mailboxId: input.mailboxId ?? '',
    emailMessageId: newId,
  });
}
```

- [ ] **Step 3: Webhook route**

```typescript
// src/http/routes/webhooks.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../../vendor/supabase.js';
import { decrypt } from '../../crypto.js';
import { enqueueSmtpJob } from '../../workers/smtpSender.js';
import { handleOutgoingFromOL } from '../../domain/email/OutgoingEmailHandler.js';
import { logger } from '../../logger.js';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/b24', async (req, reply) => {
    const body = req.body as any;
    const event = body.event;
    const memberId = body.auth?.member_id;
    const appToken = body.auth?.application_token;

    const portal = await prisma.portal.findUnique({ where: { b24MemberId: memberId } });
    if (!portal) return reply.code(404).send({ error: 'portal not found' });
    // optional: проверить, что appToken === decrypt(portal.applicationToken) — для верификации

    if (event === 'ONIMCONNECTORMESSAGEADD') {
      const data = body.data ?? {};
      const olChatId = BigInt(data.CHAT?.id ?? data.chat?.id ?? 0);
      const text = String(data.MESSAGES?.[0]?.message?.text ?? '');
      const userId = String(data.MESSAGES?.[0]?.user?.id ?? ''); // = email клиента
      const mailbox = await prisma.mailbox.findFirst({
        where: { portalId: portal.id, enabled: true },
      });
      if (!mailbox) return { ok: true, skipped: 'no mailbox' };

      const subject = await deriveSubject(olChatId);
      await handleOutgoingFromOL(
        {
          olChatId,
          text,
          clientEmail: userId,
          subject,
          mailbox: {
            email: mailbox.email,
            smtpHost: mailbox.smtpHost,
            smtpPort: mailbox.smtpPort,
            smtpUser: mailbox.smtpUser,
            smtpPassword: decrypt(mailbox.smtpPassword),
            useSsl: mailbox.useSsl,
          },
          mailboxId: mailbox.id,
        },
        {
          findLastInboundMap: async (chatId) => {
            const m = await prisma.emailMessageMap.findFirst({
              where: { olChatId: chatId, direction: 'inbound' },
              orderBy: { createdAt: 'desc' },
            });
            return m ? { emailMessageId: m.emailMessageId } : null;
          },
          enqueueSmtp: (job) => enqueueSmtpJob(job),
          recordMap: async () => {
            /* запись после успешного SMTP делается в worker */
          },
        },
      );
    }
    return { ok: true };
  });
}

async function deriveSubject(olChatId: bigint): Promise<string> {
  const last = await prisma.emailMessageMap.findFirst({
    where: { olChatId, direction: 'inbound' },
    orderBy: { createdAt: 'desc' },
  });
  return last ? 'Re: Ваше сообщение' : 'Сообщение от службы поддержки';
}
```

- [ ] **Step 4: Зарегистрировать события на портале при подключении ящика**

В `mailboxRoutes` после успешного сохранения — `event.bind` для `ONIMCONNECTORMESSAGEADD` на наш `/webhooks/b24` URL.

- [ ] **Step 5: Commit**

```bash
git add src/http/routes/webhooks.ts src/domain/email/OutgoingEmailHandler.ts tests/domain/email/OutgoingEmailHandler.test.ts
git commit -m "feat(webhooks): outgoing reply bridge OL → smtp"
```

---

### Task 2.7: SMTP sender worker

**Files:**

- Create: `src/workers/smtpSender.ts`

- [ ] **Step 1: Реализация**

```typescript
// src/workers/smtpSender.ts
import PQueue from 'p-queue';
import nodemailer from 'nodemailer';
import { prisma } from '../vendor/supabase.js';
import { logger } from '../logger.js';
import type { SmtpJob } from '../domain/email/OutgoingEmailHandler.js';

const queue = new PQueue({ concurrency: 2 });

export async function enqueueSmtpJob(job: SmtpJob): Promise<void> {
  queue.add(async () => {
    await sendOne(job);
  });
}

async function sendOne(job: SmtpJob): Promise<void> {
  const transport = nodemailer.createTransport({
    host: job.smtp.host,
    port: job.smtp.port,
    secure: job.smtp.secure,
    auth: { user: job.smtp.user, pass: job.smtp.password },
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transport.sendMail({
        from: job.from,
        to: job.to,
        subject: job.subject,
        text: job.text,
        inReplyTo: job.inReplyTo,
        references: job.references,
        messageId: job.emailMessageId,
      });
      await prisma.emailMessageMap.create({
        data: {
          mailboxId: job.mailboxId,
          emailMessageId: job.emailMessageId,
          olChatId: 0n, // outgoing не имеет ol_chat_id (приходит из webhook'a, можно сохранить отдельно)
          direction: 'outbound',
          status: 'sent',
          sentAt: new Date(),
        },
      });
      return;
    } catch (e: any) {
      logger.warn({ err: e.message, attempt }, 'smtp send failed');
      if (attempt === 3) {
        await prisma.emailMessageMap.create({
          data: {
            mailboxId: job.mailboxId,
            emailMessageId: job.emailMessageId,
            olChatId: 0n,
            direction: 'outbound',
            status: 'failed',
            error: e.message,
          },
        });
        return;
      }
      await new Promise((r) =>
        setTimeout(r, attempt === 1 ? 10_000 : attempt === 2 ? 30_000 : 120_000),
      );
    }
  }
}
```

- [ ] **Step 2: Зафиксировать упрощение для MVP**

Очередь in-memory, при крэше теряется. Это явно в спеке. Phase 2 — persistent.

- [ ] **Step 3: Commit**

```bash
git add src/workers/smtpSender.ts && git commit -m "feat(workers): smtp sender with retry queue"
```

---

### Task 2.8: Интеграционный тест Email-flow

**Files:**

- Create: `tests/integration/imap-flow.test.ts`

- [ ] **Step 1: Тест с mock-IMAP**

```bash
npm install --save-dev smtp-server imap-server testcontainers
```

```typescript
// tests/integration/imap-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe.skipIf(!process.env.RUN_INTEGRATION)('imap flow', () => {
  let pg: StartedTestContainer;
  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'p', POSTGRES_PASSWORD: 'p', POSTGRES_DB: 'commhub' })
      .withExposedPorts(5432)
      .start();
    process.env.DATABASE_URL = `postgresql://p:p@localhost:${pg.getMappedPort(5432)}/commhub`;
    // выполнить prisma migrate deploy
  });
  afterAll(async () => {
    await pg.stop();
  });

  it('e2e: simulated incoming email goes through to mocked OL', async () => {
    // 1. Поднять mock IMAP с одним письмом
    // 2. Вставить mailbox в БД
    // 3. Вызвать pollOnce(mailboxId)
    // 4. Проверить, что b24Call был вызван с правильными аргументами (мок)
    // 5. Проверить запись в email_message_map
    expect(true).toBe(true); // placeholder — реальный тест собирается под mock-imap
  });
});
```

Подробная реализация mock-IMAP опускается — это ~80 строк кода вокруг `imap-server`. Принципиально: запуск testcontainer с Postgres, программный IMAP-сервер, прогон `pollOnce`, проверка БД.

- [ ] **Step 2: Локальная проверка реальным письмом**

Подключить реальный Яндекс-ящик через UI Settings, отправить себе тестовое письмо, через 60 сек проверить:

- `SELECT * FROM email_message_map ORDER BY created_at DESC LIMIT 5;`
- На тестовом портале в Открытых линиях появилось сообщение от анонимного клиента с email-адресом.

- [ ] **Step 3: Commit**

```bash
git add tests/integration && git commit -m "test(integration): imap-flow scaffold"
git tag sprint-2-complete
```

---

# СПРИНТ 3 — Inbox UI (5 дней)

**Цель:** Двухпанельный inbox в iframe Б24 со списком всех OL-диалогов и окном переписки.

**DoD:** Пользователь открывает приложение → видит список диалогов → может прочесть и ответить, polling обновляет ленту.

---

### Task 3.1: Vite + React scaffold + iframe auth

**Files:**

- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/auth/b24Iframe.ts`

- [ ] **Step 1: Инициализация Vite**

```bash
mkdir web && cd web
npm init -y
npm install react react-dom react-router-dom
npm install --save-dev vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

`web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: { outDir: '../dist/web' },
  server: { proxy: { '/api': 'http://localhost:3000', '/oauth': 'http://localhost:3000' } },
});
```

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`web/index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Центр коммуникаций</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Iframe auth parser**

```typescript
// web/src/auth/b24Iframe.ts
export interface B24Auth {
  AUTH_ID: string;
  REFRESH_ID: string;
  DOMAIN: string;
  member_id: string;
}
export function readB24Auth(): B24Auth | null {
  const sp = new URLSearchParams(window.location.search);
  const fields = ['AUTH_ID', 'REFRESH_ID', 'DOMAIN', 'member_id'];
  for (const f of fields) if (!sp.get(f)) return null;
  return Object.fromEntries(fields.map((f) => [f, sp.get(f)!])) as unknown as B24Auth;
}
```

- [ ] **Step 3: App skeleton с роутингом**

```typescript
// web/src/App.tsx
import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { readB24Auth } from './auth/b24Iframe.js';
import { createApiClient, ApiClient } from './api/client.js';
import { Inbox } from './pages/Inbox.js';
import { Settings } from './pages/Settings.js';

export function App() {
  const [client, setClient] = useState<ApiClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readB24Auth();
    if (!auth) { setError('Откройте приложение через Битрикс24'); return; }
    createApiClient(auth).then(setClient).catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ padding: 24 }}>Ошибка: {error}</div>;
  if (!client) return <div style={{ padding: 24 }}>Загрузка…</div>;

  return (
    <HashRouter>
      <nav style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', gap: 16 }}>
        <Link to="/inbox">Inbox</Link><Link to="/settings">Настройки</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Inbox client={client} />} />
        <Route path="/inbox" element={<Inbox client={client} />} />
        <Route path="/settings/*" element={<Settings client={client} />} />
      </Routes>
    </HashRouter>
  );
}
```

```typescript
// web/src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 4: API client**

```typescript
// web/src/api/client.ts
import type { B24Auth } from '../auth/b24Iframe.js';

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
}

export async function createApiClient(auth: B24Auth): Promise<ApiClient> {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auth),
  });
  if (!res.ok) throw new Error('Не удалось аутентифицироваться');
  const { token } = (await res.json()) as { token: string };

  const call = async (m: string, path: string, body?: unknown) => {
    const r = await fetch(path, {
      method: m,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.status === 204 ? null : r.json();
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    del: (p) => call('DELETE', p),
  } as ApiClient;
}
```

- [ ] **Step 5: Frontend в production билде раздаётся Fastify**

```typescript
// src/http/server.ts — добавить
import fastifyStatic from '@fastify/static';
import path from 'path';
app.register(fastifyStatic, { root: path.resolve('dist/web'), prefix: '/app/' });
```

```bash
npm install @fastify/static
```

- [ ] **Step 6: Commit**

```bash
git add web/ src/http/server.ts package.json
git commit -m "feat(web): vite+react scaffold with iframe auth"
```

---

### Task 3.2: Список диалогов через `im.recent.get`

**Files:**

- Create: `src/http/routes/inbox.ts`, `web/src/pages/Inbox.tsx`, `web/src/components/DialogList.tsx`

- [ ] **Step 1: Backend endpoint**

```typescript
// src/http/routes/inbox.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../../vendor/supabase.js';
import { decrypt } from '../../crypto.js';
import { b24Call } from '../../vendor/b24.js';

export async function inboxRoutes(app: FastifyInstance) {
  app.get('/api/inbox/recent', async (req) => {
    const { portalId } = (req as any).session;
    const portal = await prisma.portal.findUniqueOrThrow({ where: { id: portalId } });
    const recent = await b24Call<any>({
      domain: portal.domain,
      accessToken: decrypt(portal.accessToken),
      method: 'im.recent.get',
      params: { SKIP_CHAT: 'N', SKIP_OPENLINES: 'N' },
    });
    const dialogs = (recent.items ?? recent).filter(
      (it: any) => it.chat?.type === 'lines' || it.type === 'lines',
    );
    return { dialogs };
  });

  app.get('/api/inbox/messages', async (req) => {
    const { portalId } = (req as any).session;
    const dialogId = (req.query as any).dialogId;
    const portal = await prisma.portal.findUniqueOrThrow({ where: { id: portalId } });
    const data = await b24Call<any>({
      domain: portal.domain,
      accessToken: decrypt(portal.accessToken),
      method: 'im.dialog.messages.get',
      params: { DIALOG_ID: dialogId, LIMIT: 50 },
    });
    return data;
  });

  app.post('/api/inbox/send', async (req) => {
    const { portalId } = (req as any).session;
    const { dialogId, text } = req.body as any;
    const portal = await prisma.portal.findUniqueOrThrow({ where: { id: portalId } });
    const id = await b24Call<number>({
      domain: portal.domain,
      accessToken: decrypt(portal.accessToken),
      method: 'im.message.add',
      params: { DIALOG_ID: dialogId, MESSAGE: text },
    });
    return { messageId: id };
  });
}
```

- [ ] **Step 2: DialogList компонент**

```typescript
// web/src/components/DialogList.tsx
import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client.js';

export interface Dialog { id: string; title: string; text: string; date: string; }

export function DialogList({ client, selected, onSelect }: {
  client: ApiClient; selected: string | null; onSelect: (id: string) => void;
}) {
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  useEffect(() => {
    const tick = async () => {
      const { dialogs: items } = await client.get<{ dialogs: any[] }>('/api/inbox/recent');
      setDialogs(items.map((it: any) => ({
        id: String(it.id ?? it.chat?.id),
        title: it.title ?? it.chat?.title ?? '—',
        text: it.message?.text ?? '',
        date: it.date_last_activity ?? '',
      })));
    };
    tick(); const t = setInterval(tick, 5000); return () => clearInterval(t);
  }, [client]);

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'auto', borderRight: '1px solid #eee' }}>
      {dialogs.map((d) => (
        <li key={d.id} onClick={() => onSelect(d.id)} style={{
          padding: 12, borderBottom: '1px solid #f5f5f5',
          background: selected === d.id ? '#eef5fb' : 'transparent', cursor: 'pointer',
        }}>
          <div style={{ fontWeight: 600 }}>{d.title}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{d.text.slice(0, 60)}</div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Inbox page**

```typescript
// web/src/pages/Inbox.tsx
import { useState } from 'react';
import { DialogList } from '../components/DialogList.js';
import { MessagePane } from '../components/MessagePane.js';
import { Composer } from '../components/Composer.js';
import type { ApiClient } from '../api/client.js';

export function Inbox({ client }: { client: ApiClient }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: 'calc(100vh - 49px)' }}>
      <DialogList client={client} selected={selected} onSelect={setSelected} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <MessagePane client={client} dialogId={selected} />
            <Composer client={client} dialogId={selected} />
          </>
        ) : <div style={{ padding: 24, color: '#888' }}>Выберите диалог</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: MessagePane + Composer**

```typescript
// web/src/components/MessagePane.tsx
import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client.js';

export function MessagePane({ client, dialogId }: { client: ApiClient; dialogId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    const tick = async () => {
      const data = await client.get<any>(`/api/inbox/messages?dialogId=${encodeURIComponent(dialogId)}`);
      setMessages(data.messages ?? []);
    };
    tick(); const t = setInterval(tick, 5000); return () => clearInterval(t);
  }, [client, dialogId]);
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map((m) => (
        <div key={m.id} style={{ alignSelf: m.author_id ? 'flex-end' : 'flex-start',
          background: m.author_id ? '#dbeefd' : '#f0f0f0', padding: '8px 12px', borderRadius: 8, maxWidth: '70%' }}>
          <div>{m.text}</div>
          <div style={{ fontSize: 10, color: '#888' }}>{m.date}</div>
        </div>
      ))}
    </div>
  );
}
```

```typescript
// web/src/components/Composer.tsx
import { useState } from 'react';
import type { ApiClient } from '../api/client.js';

export function Composer({ client, dialogId }: { client: ApiClient; dialogId: string }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try { await client.post('/api/inbox/send', { dialogId, text }); setText(''); }
    finally { setSending(false); }
  };
  return (
    <div style={{ borderTop: '1px solid #eee', padding: 12, display: 'flex', gap: 8 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        style={{ flex: 1, minHeight: 40, resize: 'vertical' }} placeholder="Введите ответ..." />
      <button onClick={send} disabled={sending || !text.trim()}>Отправить</button>
    </div>
  );
}
```

- [ ] **Step 5: Run, локальный smoke, commit**

```bash
# в одном окне:
npm run dev
# в другом:
cd web && npm run dev
# открыть http://localhost:5173/app/?AUTH_ID=...&member_id=...&DOMAIN=...
git add src/http/routes/inbox.ts web/src/ src/http/server.ts
git commit -m "feat(inbox): two-pane UI with polling"
```

---

### Task 3.3: Settings — таб «Почта»

**Files:**

- Create: `web/src/pages/Settings.tsx`, `web/src/components/MailboxForm.tsx`

- [ ] **Step 1: MailboxForm**

```typescript
// web/src/components/MailboxForm.tsx
import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client.js';

export function MailboxForm({ client }: { client: ApiClient }) {
  const [existing, setExisting] = useState<any>(null);
  const [form, setForm] = useState({
    email: '', imapHost: '', imapPort: 993, imapUser: '', imapPassword: '',
    smtpHost: '', smtpPort: 465, smtpUser: '', smtpPassword: '',
    useSsl: true, olLineId: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { client.get<any>('/api/mailbox').then(setExisting); }, [client]);

  const submit = async () => {
    setBusy(true); setError(null);
    try { await client.post('/api/mailbox', form); setExisting(await client.get('/api/mailbox')); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (existing) {
    return (
      <div>
        <p>Подключён: <b>{existing.email}</b> → линия #{existing.olLineId}</p>
        <button onClick={async () => { await client.del('/api/mailbox'); setExisting(null); }}>Отключить</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 500 }}>
      <h2>Подключение ящика</h2>
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="IMAP host" value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} />
      <input type="number" placeholder="IMAP port" value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: +e.target.value })} />
      <input placeholder="IMAP user" value={form.imapUser} onChange={(e) => setForm({ ...form, imapUser: e.target.value })} />
      <input type="password" placeholder="IMAP password" value={form.imapPassword} onChange={(e) => setForm({ ...form, imapPassword: e.target.value })} />
      <input placeholder="SMTP host" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
      <input type="number" placeholder="SMTP port" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: +e.target.value })} />
      <input placeholder="SMTP user" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
      <input type="password" placeholder="SMTP password" value={form.smtpPassword} onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })} />
      <input type="number" placeholder="OL Line ID" value={form.olLineId} onChange={(e) => setForm({ ...form, olLineId: +e.target.value })} />
      <button onClick={submit} disabled={busy}>{busy ? 'Проверка...' : 'Подключить'}</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Settings.tsx**

```typescript
// web/src/pages/Settings.tsx
import { NavLink, Route, Routes } from 'react-router-dom';
import { MailboxForm } from '../components/MailboxForm.js';
import { BotForm } from '../components/BotForm.js';
import type { ApiClient } from '../api/client.js';

export function Settings({ client }: { client: ApiClient }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: 16, gap: 16 }}>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NavLink to="mailbox">Почта</NavLink>
        <NavLink to="bot">Бот</NavLink>
        <NavLink to="about">О приложении</NavLink>
      </nav>
      <div>
        <Routes>
          <Route path="mailbox" element={<MailboxForm client={client} />} />
          <Route path="bot" element={<BotForm client={client} />} />
          <Route path="about" element={<div>Центр коммуникаций v0.1.0</div>} />
        </Routes>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Settings.tsx web/src/components/MailboxForm.tsx
git commit -m "feat(settings): mailbox configuration tab"
git tag sprint-3-complete
```

---

# СПРИНТ 4 — Bot (7 дней)

**Цель:** Подключаемый AI-бот: системный промпт, FAQ Q→A, handoff оператору. Работает через OpenClaw или (fallback по R5) собственная регистрация `imbot.register`.

**DoD:** Бот настроен в UI; на 3 тестовых вопроса 2 отвечает по FAQ, 1 передаёт оператору; работает в выбранных OL-линиях.

---

### Task 4.1: BotConfiguration domain + REST endpoint

**Files:**

- Create: `src/domain/bot/BotConfiguration.ts`, `src/http/routes/bot.ts`

- [ ] **Step 1: Реализация bot-config endpoint'ов**

```typescript
// src/domain/bot/BotConfiguration.ts
import { z } from 'zod';
export const FaqPair = z.object({ q: z.string().min(1).max(500), a: z.string().min(1).max(2000) });
export const BotConfigSchema = z.object({
  enabled: z.boolean(),
  systemPrompt: z.string().max(10_000),
  faq: z.array(FaqPair).max(50),
  attachedOlLines: z.array(z.number().int()).max(20),
  handoffAfterMessages: z.number().int().min(1).max(20),
  worktimeOnly: z.boolean(),
  vibecodeApiKey: z.string().optional(),
});
export type BotConfigInput = z.infer<typeof BotConfigSchema>;
```

```typescript
// src/http/routes/bot.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../../vendor/supabase.js';
import { encrypt, decrypt } from '../../crypto.js';
import { BotConfigSchema } from '../../domain/bot/BotConfiguration.js';
import { callAI } from '../../vendor/vibecode.js';

export async function botRoutes(app: FastifyInstance) {
  app.get('/api/bot', async (req) => {
    const { portalId } = (req as any).session;
    const cfg = await prisma.botConfig.findUnique({ where: { portalId } });
    if (!cfg) return null;
    return {
      enabled: cfg.enabled,
      systemPrompt: cfg.systemPrompt,
      faq: cfg.faq,
      attachedOlLines: cfg.attachedOlLines,
      handoffAfterMessages: cfg.handoffAfterMessages,
      worktimeOnly: cfg.worktimeOnly,
      hasKey: !!cfg.vibecodeApiKey,
    };
  });

  app.post('/api/bot', async (req) => {
    const { portalId } = (req as any).session;
    const parsed = BotConfigSchema.parse(req.body);
    const data: any = {
      enabled: parsed.enabled,
      systemPrompt: parsed.systemPrompt,
      faq: parsed.faq,
      attachedOlLines: parsed.attachedOlLines,
      handoffAfterMessages: parsed.handoffAfterMessages,
      worktimeOnly: parsed.worktimeOnly,
    };
    if (parsed.vibecodeApiKey) data.vibecodeApiKey = encrypt(parsed.vibecodeApiKey);
    await prisma.botConfig.upsert({
      where: { portalId },
      create: { portalId, ...data },
      update: data,
    });
    return { ok: true };
  });

  app.post('/api/bot/test', async (req, reply) => {
    const { portalId } = (req as any).session;
    const { prompt } = req.body as { prompt: string };
    const cfg = await prisma.botConfig.findUniqueOrThrow({ where: { portalId } });
    if (!cfg.vibecodeApiKey) return reply.code(400).send({ error: 'no key' });
    const response = await callAI({
      apiKey: decrypt(cfg.vibecodeApiKey),
      messages: [
        { role: 'system', content: cfg.systemPrompt || 'Помогай вежливо.' },
        { role: 'user', content: prompt },
      ],
    });
    return { response };
  });
}
```

- [ ] **Step 2: Commit**

---

### Task 4.2: VibeCode AI Router adapter

**Files:**

- Create: `src/vendor/vibecode.ts`, `tests/vendor/vibecode.test.ts`

- [ ] **Step 1: AI Router client**

```typescript
// src/vendor/vibecode.ts
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'https://vibecode.bitrix24.tech/v1';

export interface AICallInput {
  apiKey: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  responseFormat?: 'text' | 'json_object';
}

export class AIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function callAI(input: AICallInput): Promise<string> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'X-Api-Key': input.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model ?? 'bitrix/bitrixgpt-5',
        messages: input.messages,
        ...(input.responseFormat === 'json_object'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    });
    if (res.status === 429) {
      if (attempt === 3) throw new AIError(429, 'rate limited');
      const reset = res.headers.get('X-RateLimit-Reset');
      const wait = reset ? Math.max(1000, Number(reset) * 1000 - Date.now()) : 2 ** attempt * 1000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new AIError(res.status, await res.text());
    const j: any = await res.json();
    return j.choices?.[0]?.message?.content ?? '';
  }
  throw new AIError(500, 'exhausted');
}
```

- [ ] **Step 2: Тест с mock fetch (как в b24-test)**

(аналогично T1.7)

- [ ] **Step 3: Commit**

```bash
git add src/vendor/vibecode.ts tests/vendor/vibecode.test.ts
git commit -m "feat(vendor/vibecode): ai router client with rate-limit handling"
```

---

### Task 4.3: BotResponder — FAQ matching + LLM fallback

**Files:**

- Create: `src/domain/bot/BotResponder.ts`, `tests/domain/bot/BotResponder.test.ts`

- [ ] **Step 1: Тест**

```typescript
// tests/domain/bot/BotResponder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { respondToMessage } from '../../../src/domain/bot/BotResponder.js';

describe('respondToMessage', () => {
  const baseCfg = {
    enabled: true,
    systemPrompt: 'Ты бот поддержки',
    faq: [
      { q: 'Сколько стоит?', a: 'От 1000₽' },
      { q: 'Как зарегистрироваться?', a: 'На сайте example.ru' },
    ],
    handoffAfterMessages: 3,
  };

  it('returns FAQ answer on close question match', async () => {
    const llm = vi.fn();
    const r = await respondToMessage('Сколько у вас стоит услуга?', baseCfg, [], { callAI: llm });
    expect(r.text).toBe('От 1000₽');
    expect(r.handoff).toBe(false);
    expect(llm).not.toHaveBeenCalled();
  });

  it('falls back to LLM when no FAQ match', async () => {
    const llm = vi.fn().mockResolvedValue('Не знаю, передам оператору. {{HANDOFF}}');
    const r = await respondToMessage('Какая погода?', baseCfg, [], { callAI: llm });
    expect(r.handoff).toBe(true);
    expect(llm).toHaveBeenCalledOnce();
  });

  it('forces handoff after N messages', async () => {
    const llm = vi.fn().mockResolvedValue('что-то');
    const history = Array(3).fill({ role: 'user' as const, content: 'q' });
    const r = await respondToMessage('ещё вопрос', baseCfg, history, { callAI: llm });
    expect(r.handoff).toBe(true);
  });
});
```

- [ ] **Step 2: Реализация**

```typescript
// src/domain/bot/BotResponder.ts
export interface BotConfig {
  enabled: boolean;
  systemPrompt: string;
  faq: { q: string; a: string }[];
  handoffAfterMessages: number;
}
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface ResponderDeps {
  callAI: (input: { messages: ChatMessage[] }) => Promise<string>;
}

export async function respondToMessage(
  userText: string,
  cfg: BotConfig,
  history: ChatMessage[],
  deps: ResponderDeps,
): Promise<{ text: string; handoff: boolean }> {
  if (history.filter((m) => m.role === 'user').length >= cfg.handoffAfterMessages) {
    return { text: 'Передаю вас оператору, ожидайте ответа.', handoff: true };
  }
  const matched = matchFaq(userText, cfg.faq);
  if (matched) return { text: matched, handoff: false };

  const faqContext = cfg.faq.map((p) => `Q: ${p.q}\nA: ${p.a}`).join('\n\n');
  const sys = `${cfg.systemPrompt}\n\nИзвестные ответы:\n${faqContext}\n\nЕсли вопрос не входит в "Известные ответы" и ты не уверен — заверши свой ответ маркером {{HANDOFF}}.`;
  const aiText = await deps.callAI({
    messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: userText }],
  });
  const handoff = aiText.includes('{{HANDOFF}}');
  return { text: aiText.replace(/\{\{HANDOFF\}\}/g, '').trim(), handoff };
}

function matchFaq(text: string, faq: { q: string; a: string }[]): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-zа-яё0-9 ]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const tu = new Set(norm(text));
  let best: { score: number; a: string } | null = null;
  for (const pair of faq) {
    const tq = norm(pair.q);
    const overlap = tq.filter((w) => tu.has(w)).length;
    const score = overlap / Math.max(1, tq.length);
    if (score >= 0.6 && (!best || score > best.score)) best = { score, a: pair.a };
  }
  return best?.a ?? null;
}
```

- [ ] **Step 3: Run, commit**

```bash
npm test -- tests/domain/bot
git add src/domain/bot tests/domain/bot
git commit -m "feat(bot): faq matcher + llm fallback with handoff marker"
```

---

### Task 4.4: Bot Platform port — регистрация бота на портале

**Files:**

- Create: `src/domain/bot/BotPlatform.ts`

- [ ] **Step 1: Реализация (с fallback по R5)**

По результату спайка R5 — либо используем OpenClaw, либо `imbot.register`. Здесь приведена fallback-версия (ручная), как более универсальная.

```typescript
// src/domain/bot/BotPlatform.ts
export interface BotRegistrationCtx {
  domain: string;
  accessToken: string;
}
export interface BotPlatformDeps {
  b24Call: (opts: {
    domain: string;
    accessToken: string;
    method: string;
    params: any;
  }) => Promise<any>;
}

export async function ensureBotRegistered(
  ctx: BotRegistrationCtx,
  deps: BotPlatformDeps,
): Promise<{ botId: number }> {
  // Проверить, что бот уже зарегистрирован (поиск по CODE)
  const existing = await deps.b24Call({
    domain: ctx.domain,
    accessToken: ctx.accessToken,
    method: 'imbot.bot.list',
    params: {},
  });
  const found = (Array.isArray(existing) ? existing : []).find(
    (b: any) => b.CODE === 'comm_hub_bot',
  );
  if (found) return { botId: Number(found.ID) };

  const id = await deps.b24Call({
    domain: ctx.domain,
    accessToken: ctx.accessToken,
    method: 'imbot.register',
    params: {
      CODE: 'comm_hub_bot',
      NAME: 'Помощник',
      COLOR: 'AQUA',
      EVENT_HANDLER: '/webhooks/b24-bot', // отдельный endpoint для сообщений боту
      TYPE: 'B',
      PROPERTIES: {
        NAME: 'Помощник',
        LAST_NAME: '',
        WORK_POSITION: 'AI-ассистент',
      },
    },
  });
  return { botId: Number(id) };
}
```

- [ ] **Step 2: Endpoint `/webhooks/b24-bot` обрабатывает событие `ONIMBOTMESSAGEADD`**

```typescript
// дополнить src/http/routes/webhooks.ts
import { respondToMessage } from '../../domain/bot/BotResponder.js';
import { callAI } from '../../vendor/vibecode.js';

app.post('/webhooks/b24-bot', async (req, reply) => {
  const body = req.body as any;
  const memberId = body.auth?.member_id;
  const portal = await prisma.portal.findUnique({ where: { b24MemberId: memberId } });
  if (!portal) return reply.code(404).send({ error: 'unknown portal' });
  const cfg = await prisma.botConfig.findUnique({ where: { portalId: portal.id } });
  if (!cfg?.enabled) return { skipped: 'bot disabled' };

  if (body.event !== 'ONIMBOTMESSAGEADD') return { skipped: 'unsupported event' };
  const text = String(body.data?.PARAMS?.MESSAGE ?? '');
  const dialogId = String(body.data?.PARAMS?.DIALOG_ID ?? '');
  const accessToken = decrypt(portal.accessToken);

  const history: any[] = []; // TODO(Phase 2): загружать историю через im.dialog.messages.get
  const { text: answer, handoff } = await respondToMessage(
    text,
    {
      enabled: true,
      systemPrompt: cfg.systemPrompt,
      faq: cfg.faq as any[],
      handoffAfterMessages: cfg.handoffAfterMessages,
    },
    history,
    {
      callAI: async (i) => callAI({ apiKey: decrypt(cfg.vibecodeApiKey!), messages: i.messages }),
    },
  );

  await b24Call({
    domain: portal.domain,
    accessToken,
    method: 'imbot.message.add',
    params: { BOT_ID: cfg.botB24Id, DIALOG_ID: dialogId, MESSAGE: answer },
  });
  if (handoff) {
    await b24Call({
      domain: portal.domain,
      accessToken,
      method: 'imopenlines.bot.session.transfer',
      params: { CHAT_ID: dialogId, NEXT: 'queue' },
    });
  }
  return { ok: true, handoff };
});
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/bot src/http/routes/webhooks.ts
git commit -m "feat(bot): platform registration + message webhook handler"
```

---

### Task 4.5: BotForm — UI настройки бота

**Files:**

- Create: `web/src/components/BotForm.tsx`

- [ ] **Step 1: UI**

```typescript
// web/src/components/BotForm.tsx
import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client.js';

interface Faq { q: string; a: string; }
interface Cfg {
  enabled: boolean; systemPrompt: string; faq: Faq[];
  attachedOlLines: number[]; handoffAfterMessages: number; worktimeOnly: boolean;
  hasKey: boolean;
}
const empty: Cfg = { enabled: false, systemPrompt: '', faq: [], attachedOlLines: [],
  handoffAfterMessages: 3, worktimeOnly: false, hasKey: false };

export function BotForm({ client }: { client: ApiClient }) {
  const [cfg, setCfg] = useState<Cfg>(empty);
  const [keyInput, setKeyInput] = useState('');
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { client.get<Cfg>('/api/bot').then((c) => c && setCfg(c)); }, [client]);

  const save = async () => {
    setSaving(true);
    try {
      await client.post('/api/bot', { ...cfg, vibecodeApiKey: keyInput || undefined });
      setKeyInput('');
      const fresh = await client.get<Cfg>('/api/bot'); if (fresh) setCfg(fresh);
    } finally { setSaving(false); }
  };
  const addFaq = () => setCfg({ ...cfg, faq: [...cfg.faq, { q: '', a: '' }] });
  const updateFaq = (i: number, patch: Partial<Faq>) => {
    const next = [...cfg.faq]; next[i] = { ...next[i]!, ...patch }; setCfg({ ...cfg, faq: next });
  };
  const removeFaq = (i: number) => setCfg({ ...cfg, faq: cfg.faq.filter((_, j) => j !== i) });

  const runTest = async () => {
    const { response } = await client.post<{ response: string }>('/api/bot/test', { prompt: testPrompt });
    setTestResponse(response);
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
      <h2>Бот</h2>
      <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Включить бота</label>
      <textarea rows={4} placeholder="Системный промпт" value={cfg.systemPrompt}
        onChange={(e) => setCfg({ ...cfg, systemPrompt: e.target.value })} />
      <div>
        <h3>FAQ</h3>
        {cfg.faq.map((f, i) => (
          <div key={i} style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
            <input placeholder="Вопрос" value={f.q} onChange={(e) => updateFaq(i, { q: e.target.value })} />
            <textarea placeholder="Ответ" value={f.a} onChange={(e) => updateFaq(i, { a: e.target.value })} />
            <button onClick={() => removeFaq(i)}>Удалить</button>
          </div>
        ))}
        <button onClick={addFaq} disabled={cfg.faq.length >= 50}>+ Пара (макс 50)</button>
      </div>
      <label>Передать оператору после {' '}
        <input type="number" value={cfg.handoffAfterMessages} min={1} max={20}
          onChange={(e) => setCfg({ ...cfg, handoffAfterMessages: +e.target.value })} /> сообщений
      </label>
      <label><input type="checkbox" checked={cfg.worktimeOnly} onChange={(e) => setCfg({ ...cfg, worktimeOnly: e.target.checked })} /> Только в нерабочее время</label>
      <div>
        VibeCode API ключ {cfg.hasKey && '(сохранён, введите новый чтобы заменить)'}
        <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
      </div>
      <button onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
      <hr />
      <h3>Тест</h3>
      <input value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} placeholder="Введите тестовое сообщение" />
      <button onClick={runTest} disabled={!cfg.hasKey}>Спросить бота</button>
      {testResponse && <pre style={{ background: '#f7f7f7', padding: 12 }}>{testResponse}</pre>}
    </div>
  );
}
```

- [ ] **Step 2: Подключить настройки к OL-линиям**

После сохранения конфига бота — для каждой линии из `attachedOlLines` вызвать:

```typescript
// backend: при POST /api/bot — если изменился список линий, обновить через imopenlines.config.update
// каждая линия — set "active_chatbot" в bot_b24_id
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/BotForm.tsx web/src/pages/Settings.tsx
git commit -m "feat(settings): bot configuration ui with test"
git tag sprint-4-complete
```

---

# СПРИНТ 5 — Production-ready (5 дней)

**Цель:** CI/CD, healthcheck, корректное удаление приложения, QA по 7 критериям приёмки.

---

### Task 5.1: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: CI**

```yaml
# .github/workflows/ci.yml
name: CI
on: { push: { branches: [main] }, pull_request: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: p, POSTGRES_PASSWORD: p, POSTGRES_DB: commhub }
        ports: ['5432:5432']
        options: --health-cmd "pg_isready -U p" --health-interval 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://p:p@localhost:5432/commhub
      MASTER_ENCRYPTION_KEY_BASE64: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
      JWT_SECRET: ci-secret-min-16-chars
      B24_CLIENT_ID: ci
      B24_CLIENT_SECRET: ci
      APP_BASE_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx prisma migrate deploy
      - run: npm test
      - run: npm run build
      - run: cd web && npm ci && npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github && git commit -m "ci: github actions test+build"
```

---

### Task 5.2: Deploy job в GitHub Actions

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Добавить deploy job**

```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: npm ci
    - run: cd web && npm ci && npm run build
    - run: tar --exclude=node_modules --exclude=.git -czf /tmp/commhub.tar.gz .
    - name: Deploy to VibeCode
      env:
        VIBECODE_API_KEY: ${{ secrets.VIBECODE_API_KEY }}
        VIBECODE_SERVER_ID: ${{ secrets.VIBECODE_SERVER_ID }}
      run: npx tsx scripts/deploy-vibecode.ts
```

- [ ] **Step 2: Настроить repository secrets**

В GitHub → Settings → Secrets: `VIBECODE_API_KEY`, `VIBECODE_SERVER_ID`.

- [ ] **Step 3: Commit, push, проверить деплой**

```bash
git add .github && git commit -m "ci: deploy to vibecode on main"
git push origin main
# в Actions проверить, что deploy job завершился
```

---

### Task 5.3: Uninstall flow

**Files:**

- Create: `src/domain/portal/UninstallFlow.ts`, modify: `src/http/routes/oauth.ts`

- [ ] **Step 1: Endpoint `/oauth/uninstall` (вебхук от Б24)**

Б24 при удалении приложения слёт `ONAPPUNINSTALL`. Обработчик:

```typescript
// src/domain/portal/UninstallFlow.ts
import { prisma } from '../../vendor/supabase.js';
import { b24Call } from '../../vendor/b24.js';
import { decrypt } from '../../crypto.js';
import { CONNECTOR_ID } from '../connector/ConnectorRegistration.js';
import { logger } from '../../logger.js';

export async function handleUninstall(memberId: string) {
  const portal = await prisma.portal.findUnique({ where: { b24MemberId: memberId } });
  if (!portal) return;
  const accessToken = decrypt(portal.accessToken);
  // Деактивировать коннектор (best-effort)
  try {
    await b24Call({
      domain: portal.domain,
      accessToken,
      method: 'imconnector.unregister',
      params: { CONNECTOR: CONNECTOR_ID },
    });
  } catch (e) {
    logger.warn(e, 'unregister connector failed');
  }
  // Удалить бота
  const cfg = await prisma.botConfig.findUnique({ where: { portalId: portal.id } });
  if (cfg?.botB24Id) {
    try {
      await b24Call({
        domain: portal.domain,
        accessToken,
        method: 'imbot.unregister',
        params: { BOT_ID: cfg.botB24Id },
      });
    } catch (e) {
      logger.warn(e, 'unregister bot failed');
    }
  }
  await prisma.portal.update({ where: { id: portal.id }, data: { uninstalledAt: new Date() } });
}
```

- [ ] **Step 2: Webhook**

```typescript
// в webhooks.ts — добавить обработчик
app.post('/webhooks/b24-uninstall', async (req) => {
  const body = req.body as any;
  if (body.event === 'ONAPPUNINSTALL') await handleUninstall(body.auth?.member_id);
  return { ok: true };
});
```

При установке приложения — зарегистрировать обработчик через `event.bind`.

- [ ] **Step 3: Commit**

---

### Task 5.4: Healthcheck расширенный + structured logging

**Files:**

- Modify: `src/http/server.ts`

- [ ] **Step 1: Расширить /healthz**

```typescript
app.get('/healthz', async () => {
  const checks: Record<string, 'ok' | 'fail'> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'fail';
  }
  try {
    const r = await fetch('https://vibecode.bitrix24.tech/v1/models', {
      headers: { 'X-Api-Key': config.vibecodeApiKey ?? '' },
    });
    checks.ai = r.ok ? 'ok' : 'fail';
  } catch {
    checks.ai = 'fail';
  }
  return { status: Object.values(checks).every((v) => v === 'ok') ? 'ok' : 'degraded', checks };
});
```

- [ ] **Step 2: Commit**

---

### Task 5.5: Финальная QA — прогон 7 критериев приёмки

**Files:**

- Create: `docs/qa-checklist.md`

- [ ] **Step 1: Чеклист**

```markdown
# QA Checklist — Sprint 5

- [ ] 1. Установка приложения на тестовый портал в 1 клик
- [ ] 2. Подключение IMAP/SMTP ящика: ошибки валидации понятны
- [ ] 3. Письмо извне → попало в inbox ≤90s, в OL ≤90s, в CRM создан/найден лид
- [ ] 4. Ответ оператора → клиент получил email ≤30s, корректный In-Reply-To
- [ ] 5. В inbox видны диалоги ≥2 разных каналов
- [ ] 6. Бот с 3 FAQ: 2 совпадающих → FAQ ответ; 1 не из FAQ → {{HANDOFF}}
- [ ] 7. Удаление приложения → коннектор unregistered, бот unregistered, в БД uninstalled_at не null
```

- [ ] **Step 2: Прогнать всё на тестовом портале**

- [ ] **Step 3: Зафиксировать результаты, тэг**

```bash
git add docs/qa-checklist.md
git commit -m "docs: qa checklist completed"
git tag sprint-5-complete
git tag mvp-v0.1.0
```

---

# Финальная сводка

| Спринт              | Tasks | Длительность | Тег                                |
| ------------------- | ----- | ------------ | ---------------------------------- |
| 0 — Спайк           | 9     | 5 дней       | `sprint-0-complete`                |
| 1 — Foundation      | 11    | 5 дней       | `sprint-1-complete`                |
| 2 — Email Connector | 8     | 7 дней       | `sprint-2-complete`                |
| 3 — Inbox UI        | 3     | 5 дней       | `sprint-3-complete`                |
| 4 — Bot             | 5     | 7 дней       | `sprint-4-complete`                |
| 5 — Production      | 5     | 5 дней       | `sprint-5-complete` + `mvp-v0.1.0` |

**Итого:** 41 задача, ~34 рабочих дня (~7 недель при 1 разработчике middle+).

**После MVP:** см. секцию 12 спеки (Phase 2 features) — двойная привязка к CRM Activity, RAG с файлами, Whisper, WebSocket, persistent SMTP queue, миграция со VibeCode на свой сервер (переписать только `src/vendor/*.ts`).
