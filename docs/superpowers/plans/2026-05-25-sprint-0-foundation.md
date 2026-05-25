# Sprint 0 — Foundation & Local Dev. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять каркас `b24-ai-starter` локально только в Node.js-варианте, провести успешную OAuth-установку в тестовый портал Битрикс24, показать страницу настроек в iframe портала.

**Architecture:** Используем стартер `b24-ai-starter` как основу. Из трёх предложенных бэкендов оставляем только Node.js (Express 5). Удаляем PHP и Python. Frontend — Nuxt 4 с `b24jssdk-nuxt`. OAuth-handler принимает payload от Битрикса при установке приложения и сохраняет токены в Postgres. Минимальная страница настроек рендерится в iframe и подтверждает работу полного цикла.

**Tech Stack:** Node.js 20, Express 5, Nuxt 4, Postgres 17, Docker Compose, `pg`, `jsonwebtoken`, `@bitrix24/b24jssdk-nuxt`, `vitest`.

**Связанная спека:** [`2026-05-25-support-chat-hub-design.md`](../specs/2026-05-25-support-chat-hub-design.md)
**Мастер-план:** [`2026-05-25-sprint-master-plan.md`](2026-05-25-sprint-master-plan.md)

---

## Подготовка к работе по плану

Прежде чем брать первую задачу, исполнитель **обязан**:
1. Прочитать `docs/superpowers/specs/2026-05-25-support-chat-hub-design.md` (понимание гипотезы и негативного скоупа).
2. Прочитать `docs/superpowers/plans/2026-05-25-sprint-master-plan.md` секции Sprint 0 (общая цель и AC).
3. Прочитать `docs/workflow.md` (правила веток и коммитов).
4. Прочитать `.claude/skills/develop-b24-node/SKILL.md` и `.claude/skills/manage-b24-environment/SKILL.md` стартера.

---

## Task 1: Удалить PHP и Python из стартера

**Цель:** оставить только Node.js-бэкенд. Никаких PHP/Python остатков в репо и docker-compose.

**Files:**
- Delete: `backends/php/` (вся директория)
- Delete: `backends/python/` (вся директория)
- Modify: `docker-compose.yml` (удалить сервисы `api-php`, `php-cli`, `api-python` и связанные volumes/networks)
- Modify: `makefile` (удалить таргеты `dev-php`, `prod-php`, `composer-*`, `dev-python`, `prod-python`)
- Modify: `instructions/` — удалить `php/` и `python/` поддиректории
- Delete: `.claude/skills/develop-b24-php/`, `.claude/skills/develop-b24-python/`, `.cursor/skills/develop-b24-php/`, `.cursor/skills/develop-b24-python/`
- Delete: `scripts/fix-php.sh`
- Modify: `instructions/queues/` — удалить `php.md`, `python.md`

- [ ] **Step 1: Создать ветку `feature/sprint-0-strip-starter`**

```bash
git checkout -b feature/sprint-0-strip-starter
```

- [ ] **Step 2: Удалить PHP и Python бэкенды и связанные файлы**

```bash
git rm -rf backends/php backends/python
git rm -rf instructions/php instructions/python
git rm -rf .claude/skills/develop-b24-php .claude/skills/develop-b24-python
git rm -rf .cursor/skills/develop-b24-php .cursor/skills/develop-b24-python
git rm scripts/fix-php.sh
git rm instructions/queues/php.md instructions/queues/python.md
```

- [ ] **Step 3: Прочитать `docker-compose.yml` целиком**

Read: `docker-compose.yml`. Запомнить структуру: какие сервисы используют `service_healthy` от `database-postgres`, какие volumes есть.

- [ ] **Step 4: Удалить из `docker-compose.yml` сервисы `api-php`, `php-cli`, `api-python` и их секции**

Найти и удалить **все** YAML-блоки, относящиеся к этим сервисам, включая:
- сам сервис (с `image`, `build`, `environment`, `depends_on`, `volumes`, `profiles`).
- volumes специфичные для них (`composer_cache`, если есть).
- profile-ссылки в других сервисах (например, в `database-postgres` может быть `profiles: [php, python, node, php-cli]` — оставить только `node`).

После правки `docker-compose config` должен валидно парсить файл:

```bash
docker compose config > /dev/null && echo "OK"
```

Expected output: `OK` (без ошибок YAML).

- [ ] **Step 5: Удалить из `makefile` PHP- и Python-таргеты**

Удалить следующие группы таргетов (искать по grep):
- `dev-php`, `prod-php`
- `dev-python`, `prod-python`
- `composer-*` (все таргеты с `composer-` в названии)
- `python-*` (если есть)
- `fix-php`

Проверка: `make help` (или `make` без аргументов) показывает только Node-таргеты.

- [ ] **Step 6: Удалить из `instructions/knowledge.md` и других файлов упоминания PHP/Python**

```bash
grep -lr "php\|python\|symfony\|django" instructions/ || true
```

Для каждого файла из вывода — открыть, удалить блоки/упоминания PHP и Python (но не упоминание Node.js).

- [ ] **Step 7: Проверить, что `docker compose up database-postgres` поднимается**

```bash
cp .env.example .env
docker compose --profile db-postgres up -d database-postgres
docker compose ps
```

Expected: сервис `database-postgres` со статусом `healthy` через 10-15 секунд.

- [ ] **Step 8: Остановить и закоммитить**

```bash
docker compose down
git add -A
git commit -m "chore: strip PHP and Python from starter, keep Node.js only"
```

- [ ] **Step 9: Push и открыть PR**

```bash
git push -u origin feature/sprint-0-strip-starter
```

Открыть PR в GitHub UI с описанием: «Удалены PHP и Python бэкенды. Оставлен только Node.js. Связано с Task 1 Sprint 0».

---

## Task 2: Базовая конфигурация локального окружения

**Цель:** один-к-одному настроить `.env` и поднять весь Node-стек локально.

**Files:**
- Modify: `.env` (не коммитим — gitignored; создаётся локально из `.env.example`)

- [ ] **Step 1: Merge Task 1 в `main`, переключиться на новую ветку**

```bash
git checkout main
git pull origin main
git checkout -b feature/sprint-0-local-env
```

- [ ] **Step 2: Скопировать `.env.example` в `.env`**

```bash
cp .env.example .env
```

- [ ] **Step 3: В `.env` заполнить локальные значения**

Открыть `.env` и установить (остальное оставить дефолтным):

```dotenv
# JWT
JWT_SECRET=local_dev_jwt_secret_do_not_use_in_prod_change_me
JWT_ALGORITHM=HS256

# OAuth Б24 — оставляем плейсхолдеры, заполним в Task 3 после регистрации приложения
CLIENT_ID=will_be_set_after_app_registration
CLIENT_SECRET=will_be_set_after_app_registration
SCOPE=imopenlines,imconnector,im,crm,user,disk,placement

# Domain — будем использовать CloudPub для туннелирования
VIRTUAL_HOST=http://localhost:3000
SERVER_HOST=http://api-node:8000

# DB
DB_TYPE=postgresql
DB_NAME=commhub
DB_USER=commhub
DB_PASSWORD=commhub_local_pass
DB_ROOT_PASSWORD=root_local_pass
DB_PORT=5432
DATABASE_URL=postgresql://commhub:commhub_local_pass@database-postgres:5432/commhub?serverVersion=17

# RabbitMQ — пока выключен, включим в Sprint 4
ENABLE_RABBITMQ=0

# OpenTelemetry — выключен для упрощения R&D
TELEMETRY_ENABLED=false
```

- [ ] **Step 4: Запустить стек `make dev-node`**

```bash
make dev-node
```

Expected: docker-compose поднимает `database-postgres`, `api-node`, `frontend`. Логи показывают, что Express слушает на 8000, Nuxt на 3000.

Если возникает ошибка `make: *** No rule to make target 'dev-node'` — проверить, что Task 1 не удалил `dev-node` случайно. Восстановить таргет, если удалён.

- [ ] **Step 5: Проверить, что Postgres доступен и есть стартовая схема**

```bash
docker compose exec database-postgres psql -U commhub -d commhub -c "\dt"
```

Expected: видны таблицы из `infrastructure/database/init.sql` — `bitrix24account`, `application_installation`.

- [ ] **Step 6: Проверить health-чек бэкенда**

```bash
curl -s http://localhost:8000/api/health || curl -s http://localhost:8000/
```

Если эндпоинта `/api/health` нет — это нормально для текущего скелета, проверка в Step 7 будет через `/api/install`.

- [ ] **Step 7: Проверить, что фронт открывается**

В браузере: `http://localhost:3000`. Ожидание: страница загружается (даже если показывает ошибку «не в iframe Битрикса» — это нормально, главное что Nuxt сервит).

- [ ] **Step 8: Закоммитить документацию по локальному запуску (без `.env`!)**

Создать файл `docs/local-dev.md` с шагами выше для будущих разработчиков:

```markdown
# Локальная разработка

## Первый запуск
1. `cp .env.example .env`
2. Отредактировать `.env` (см. список значений в `docs/superpowers/plans/2026-05-25-sprint-0-foundation.md`, Task 2 Step 3)
3. `make dev-node`
4. Постгрес доступен на `localhost:5432`, Express API на `localhost:8000`, Nuxt на `localhost:3000`

## Проверка
- `docker compose ps` — все сервисы `healthy`
- `docker compose logs api-node` — логи бэкенда
- `docker compose logs frontend` — логи фронта

## Остановка
- `make down`
```

```bash
git add docs/local-dev.md
git commit -m "docs: добавлена инструкция по локальному запуску стека"
```

---

## Task 3: Зарегистрировать тестовое приложение в Битрикс24

**Цель:** получить реальные `CLIENT_ID` и `CLIENT_SECRET` для OAuth-flow. **Это ручной шаг** — выполняет владелец репозитория.

**Files:** Изменения только в `.env` (локально, не коммитим)

**Внимание:** Эта задача требует доступа к тестовому порталу Битрикс24. Если такого портала нет — создать бесплатный пробный по [bitrix24.ru](https://www.bitrix24.ru/) (15 минут).

- [ ] **Step 1: На тестовом портале Б24 — перейти в «Приложения → Разработчикам → Локальное приложение»**

URL: `https://{ваш-портал}.bitrix24.ru/devops/`

- [ ] **Step 2: Создать локальное приложение**

Параметры:
- **Тип:** «Серверное приложение»
- **Название:** `Support Chat Hub (R&D)`
- **Код приложения:** `support_chat_hub_dev`
- **Путь обработчика:** `https://{ваш-cloudpub-домен}/api/install` (получим домен в Step 4)
- **Путь для начальной установки:** `https://{ваш-cloudpub-домен}/app`
- **Разрешения (scope):** отметить `Открытые линии (imopenlines)`, `Коннекторы (imconnector)`, `Чат и уведомления (im)`, `CRM (crm)`, `Пользователи (user)`, `Диск (disk)`, `Размещение приложений (placement)`

- [ ] **Step 3: Сохранить выданные `CLIENT_ID` и `CLIENT_SECRET`**

Записать их в пароль-менеджер. **Никогда не коммитить в git.**

- [ ] **Step 4: Поднять CloudPub-туннель**

CloudPub нужен, чтобы Битрикс мог достучаться до локального бэкенда. Стартер уже включает CloudPub-сервис.

```bash
docker compose --profile cloudpub up -d cloudpub
docker compose logs cloudpub | grep "https://"
```

Expected: в логах есть URL вида `https://xxxx.cloudpub.ru` — это публичный туннель на `localhost:8000`.

- [ ] **Step 5: Обновить в `.env` значения CLIENT_ID, CLIENT_SECRET, VIRTUAL_HOST**

```dotenv
CLIENT_ID=<значение из Step 3>
CLIENT_SECRET=<значение из Step 3>
VIRTUAL_HOST=https://xxxx.cloudpub.ru
```

- [ ] **Step 6: Обновить в Б24 «Путь обработчика» на актуальный CloudPub URL**

В UI Битрикса (Devops → ваше приложение → Редактировать) поставить:
- Путь обработчика: `https://xxxx.cloudpub.ru/api/install`
- Путь начальной установки: `https://xxxx.cloudpub.ru/app`

- [ ] **Step 7: Перезапустить бэкенд, чтобы он подхватил новые env**

```bash
docker compose restart api-node
```

- [ ] **Step 8: Зафиксировать инструкцию для будущей команды**

Создать файл `docs/setup-test-portal.md`:

```markdown
# Регистрация тестового приложения в Битрикс24

Для локальной разработки нужно зарегистрировать локальное приложение на тестовом портале Битрикс24 и получить OAuth-ключи.

См. подробные шаги: `docs/superpowers/plans/2026-05-25-sprint-0-foundation.md`, Task 3.

## Кратко
1. Создать бесплатный портал на bitrix24.ru
2. Devops → Локальное приложение → Создать
3. Тип: серверное, scope: imopenlines, imconnector, im, crm, user, disk, placement
4. Поднять `cloudpub` (`docker compose --profile cloudpub up -d cloudpub`)
5. Прописать в Б24 URL обработчика: `{cloudpub-url}/api/install`
6. Записать CLIENT_ID и CLIENT_SECRET в `.env`
```

```bash
git add docs/setup-test-portal.md
git commit -m "docs: инструкция по регистрации тестового приложения в Б24"
```

---

## Task 4: Реализовать OAuth install handler

**Цель:** парсить payload от Битрикса при установке, валидировать его, сохранять токены в `bitrix24account` таблице. Заменить текущую заглушку.

**Files:**
- Modify: `backends/node/api/server.js` (заменить stub install endpoint)
- Create: `backends/node/api/install.js` (новый модуль с логикой)
- Create: `backends/node/api/__tests__/install.test.js` (unit-тесты)
- Modify: `backends/node/package.json` (добавить `vitest`)

- [ ] **Step 1: Прочитать существующий `backends/node/api/server.js`**

Read: `backends/node/api/server.js`. Понять:
- Какие middleware подключены
- Как сейчас выглядит `/api/install` (это stub из ответа разведки)
- Как настроен pool для `pg`

- [ ] **Step 2: Прочитать схему `infrastructure/database/init.sql`**

Read: `infrastructure/database/init.sql`. Найти колонки таблицы `bitrix24account` — нам важны: `member_id`, `domain_url`, `access_token`, `refresh_token`, `auth_expires`, `application_token`.

- [ ] **Step 3: Установить vitest как dev-зависимость**

```bash
docker compose exec api-node npm install --save-dev vitest @vitest/coverage-v8
```

Или если стартер использует `npm ci` workflow — добавить вручную в `backends/node/package.json` в `devDependencies`:

```json
"vitest": "^1.6.0",
"@vitest/coverage-v8": "^1.6.0"
```

И добавить в секцию `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Написать падающий тест `install.test.js`**

Create: `backends/node/api/__tests__/install.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleInstall } from '../install.js';

const MOCK_INSTALL_PAYLOAD = {
  event: 'ONAPPINSTALL',
  data: {
    VERSION: '1',
    LANGUAGE_ID: 'ru'
  },
  ts: '1748102400',
  auth: {
    access_token: 'test_access_token_xyz',
    expires: '1748106000',
    expires_in: '3600',
    scope: 'imopenlines,imconnector,im,crm,user,disk,placement',
    domain: 'test-portal.bitrix24.ru',
    server_endpoint: 'https://oauth.bitrix.info/rest/',
    status: 'L',
    client_endpoint: 'https://test-portal.bitrix24.ru/rest/',
    member_id: 'abcdef0123456789abcdef0123456789',
    user_id: '1',
    refresh_token: 'test_refresh_token_xyz',
    application_token: 'application_token_xyz'
  }
};

describe('handleInstall', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 42 }] })
    };
  });

  it('сохраняет аккаунт при валидном payload', async () => {
    const result = await handleInstall(MOCK_INSTALL_PAYLOAD, mockPool);

    expect(result.ok).toBe(true);
    expect(mockPool.query).toHaveBeenCalledOnce();
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO bitrix24account/i);
    expect(params).toContain('abcdef0123456789abcdef0123456789'); // member_id
    expect(params).toContain('test-portal.bitrix24.ru'); // domain
  });

  it('возвращает ошибку, если auth-секция отсутствует', async () => {
    const badPayload = { event: 'ONAPPINSTALL', data: {} };
    const result = await handleInstall(badPayload, mockPool);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/auth/i);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('обновляет существующий аккаунт при повторной установке (upsert)', async () => {
    await handleInstall(MOCK_INSTALL_PAYLOAD, mockPool);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/i);
  });
});
```

- [ ] **Step 5: Запустить тест — проверить, что он падает**

```bash
docker compose exec api-node npm test -- install.test.js
```

Expected: `FAIL` с сообщением что `handleInstall` не определён или модуль `install.js` не найден.

- [ ] **Step 6: Реализовать `install.js`**

Create: `backends/node/api/install.js`

```javascript
export async function handleInstall(payload, pool) {
  if (!payload || !payload.auth) {
    return { ok: false, error: 'Missing auth section in install payload' };
  }

  const a = payload.auth;
  const required = ['member_id', 'domain', 'access_token', 'refresh_token', 'expires'];
  for (const field of required) {
    if (!a[field]) {
      return { ok: false, error: `Missing required auth field: ${field}` };
    }
  }

  const expiresAt = new Date(parseInt(a.expires, 10) * 1000).toISOString();

  const sql = `
    INSERT INTO bitrix24account (
      member_id, domain_url, access_token, refresh_token,
      auth_expires, application_token, status, installed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
    ON CONFLICT (member_id) DO UPDATE SET
      domain_url = EXCLUDED.domain_url,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      auth_expires = EXCLUDED.auth_expires,
      application_token = EXCLUDED.application_token,
      status = 'active',
      installed_at = NOW()
    RETURNING id
  `;

  const params = [
    a.member_id,
    a.domain,
    a.access_token,
    a.refresh_token,
    expiresAt,
    a.application_token || null
  ];

  try {
    const result = await pool.query(sql, params);
    return { ok: true, id: result.rows[0].id };
  } catch (err) {
    return { ok: false, error: `DB error: ${err.message}` };
  }
}
```

- [ ] **Step 7: Запустить тест — проверить, что он проходит**

```bash
docker compose exec api-node npm test -- install.test.js
```

Expected: все 3 теста зелёные.

- [ ] **Step 8: Подключить `handleInstall` к Express в `server.js`**

Modify: `backends/node/api/server.js`. Найти существующий обработчик `app.post('/api/install', ...)` и заменить его на:

```javascript
import { handleInstall } from './install.js';

// ... в секции маршрутов:
app.post('/api/install', async (req, res) => {
  const result = await handleInstall(req.body, pool);
  if (!result.ok) {
    console.error('Install failed:', result.error);
    return res.status(400).json({ error: result.error });
  }
  console.log(`Install OK: account id=${result.id}, member=${req.body.auth.member_id}`);
  res.json({ ok: true });
});
```

- [ ] **Step 9: Перезапустить бэкенд и проверить smoke-test**

```bash
docker compose restart api-node
curl -X POST http://localhost:8000/api/install \
  -H "Content-Type: application/json" \
  -d '{"event":"ONAPPINSTALL","auth":{"member_id":"smoke","domain":"smoke.local","access_token":"t","refresh_token":"r","expires":"1748106000"}}'
```

Expected: ответ `{"ok":true}`. В Postgres:

```bash
docker compose exec database-postgres psql -U commhub -d commhub -c "SELECT id, member_id, domain_url FROM bitrix24account WHERE member_id='smoke';"
```

Expected: одна строка с `member_id=smoke`.

- [ ] **Step 10: Закоммитить**

```bash
git add backends/node/
git commit -m "feat(install): реализован OAuth install handler с upsert и тестами"
```

---

## Task 5: Реальная OAuth-установка через тестовый портал

**Цель:** установить приложение в реальный тестовый портал, увидеть запись в БД.

**Files:** Нет изменений в коде — это ручная проверка.

- [ ] **Step 1: Убедиться, что Task 3 завершён (CLIENT_ID/SECRET прописаны, CloudPub поднят)**

```bash
docker compose ps cloudpub
echo "CLIENT_ID=$(grep CLIENT_ID .env | cut -d= -f2)"
```

Expected: `cloudpub` со статусом `Up`, `CLIENT_ID` непустой.

- [ ] **Step 2: На тестовом портале установить приложение**

В UI Битрикса: «Приложения → Установленные → ваш Support Chat Hub (R&D) → Установить».

- [ ] **Step 3: Проверить логи бэкенда**

```bash
docker compose logs api-node --tail 50
```

Expected: строка `Install OK: account id=X, member=YYYYYYYY`.

- [ ] **Step 4: Проверить запись в БД**

```bash
docker compose exec database-postgres psql -U commhub -d commhub \
  -c "SELECT id, member_id, domain_url, auth_expires FROM bitrix24account ORDER BY id DESC LIMIT 1;"
```

Expected: одна свежая строка с реальным `member_id` (32-символьный хеш) и `domain_url` тестового портала.

- [ ] **Step 5: Если что-то не работает — отладка**

Если запись не появилась:
- Проверить, что в Б24 правильно прописан URL обработчика (Task 3 Step 6).
- Проверить логи cloudpub: `docker compose logs cloudpub --tail 50` — был ли HTTP-запрос на `/api/install`.
- Проверить статус-код в логах api-node.

- [ ] **Step 6: Зафиксировать результат**

Если всё работает — `git status` показывает «working tree clean» (этот таск не меняет код). Перейти к Task 6.

---

## Task 6: Frontend — страница «Hello world» в iframe

**Цель:** при открытии настроек приложения в портале — увидеть в iframe страницу с приветствием по имени домена портала.

**Files:**
- Read: `frontend/app/pages/install.client.vue`, `frontend/app/pages/index.client.vue`, `frontend/app/layouts/default.vue` — понять текущий шаблон
- Create: `frontend/app/pages/settings.client.vue`
- Modify: `backends/node/api/server.js` (добавить эндпоинт `/api/session` для валидации AUTH_ID и выдачи нашего JWT)

- [ ] **Step 1: Создать ветку**

```bash
git checkout main
git pull origin main
git checkout -b feature/sprint-0-hello-world-settings
```

- [ ] **Step 2: Изучить существующие страницы**

Read: `frontend/app/pages/index.client.vue`, `frontend/app/pages/install.client.vue`, `frontend/app/layouts/placement.vue`, `frontend/app/plugins/` (где инициализируется b24jssdk).

Запомнить:
- Как страницы получают данные авторизации из iframe Битрикса (через `b24jssdk-nuxt` placement).
- Какой layout использовать для placement-страниц.

- [ ] **Step 3: Создать новую страницу настроек**

Create: `frontend/app/pages/settings.client.vue`

```vue
<script setup lang="ts">
definePageMeta({ layout: 'placement' });

const { $b24 } = useNuxtApp();
const domain = ref<string>('');
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const auth = await $b24.getAuth();
    domain.value = auth.domain;
  } catch (e: any) {
    error.value = e.message || 'Не удалось получить авторизацию из iframe Битрикса';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="settings-page">
    <h1>Support Chat Hub — Настройки</h1>
    <p v-if="loading">Загрузка...</p>
    <p v-else-if="error" class="error">Ошибка: {{ error }}</p>
    <p v-else>Привет, портал <strong>{{ domain }}</strong>! 👋</p>
    <p class="todo">Здесь в следующих спринтах появится форма подключения почтового ящика.</p>
  </div>
</template>

<style scoped>
.settings-page {
  font-family: system-ui, sans-serif;
  padding: 24px;
}
.error { color: #c00; }
.todo { color: #888; margin-top: 32px; font-size: 0.9em; }
</style>
```

- [ ] **Step 4: В тестовом портале добавить placement «Настройки»**

В Б24 (Devops → ваше приложение → Редактировать): добавить **встройку (placement)** с параметрами:
- **Код места встройки:** `SETTINGS_CONNECTOR`
- **Адрес обработчика:** `{cloudpub-url}/app/settings` (для Nuxt URL роутится из `pages/`)
- **Название:** `Support Chat Hub`

Если этого не позволяет API локального приложения — добавить placement программно в Task 4-шаге `handleInstall` через REST вызов `placement.bind`. На R&D-стадии достаточно ручного шага.

- [ ] **Step 5: Перезапустить frontend и проверить**

```bash
docker compose restart frontend
```

В тестовом портале: перейти к ОЛ → раздел «Настройки» (или другое место, куда привязали placement) → должен открыться iframe с приветствием.

Expected: в iframe видна страница «Привет, портал {ваш-домен}.bitrix24.ru!».

- [ ] **Step 6: Если страница не открывается / ошибка авторизации**

Дебаг:
- DevTools браузера: вкладка Network — что отдаёт `/app/settings`?
- DevTools Console: ошибки от `b24jssdk-nuxt`?
- Логи: `docker compose logs frontend --tail 100`

Возможная причина: `b24jssdk` ожидает, что страница открыта именно в iframe Битрикса. Через прямой URL `localhost:3000/settings` авторизация не пройдёт — это нормально.

- [ ] **Step 7: Закоммитить**

```bash
git add frontend/
git commit -m "feat(settings): hello-world страница настроек в iframe портала"
```

---

## Task 7: CI workflow — lint + typecheck для бэка и фронта

**Цель:** при открытии PR в `main` запускаются проверки линта и типов. Кнопка merge заблокирована до их прохождения.

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `backends/node/package.json` (добавить `lint` script если нет; `typecheck` для TS — но Node-бэкенд на JS, так что ограничимся lint)
- Modify: `frontend/package.json` (убедиться, что `lint` и `typecheck` есть)

- [ ] **Step 1: Создать ветку**

```bash
git checkout main
git pull origin main
git checkout -b feature/sprint-0-ci
```

- [ ] **Step 2: Проверить, что в `backends/node/package.json` есть скрипт lint**

Read: `backends/node/package.json`. Если в `scripts` нет `lint` — добавить:

```json
"lint": "eslint api/ utils/ --ext .js"
```

Если нет ESLint — установить минимальную конфигурацию:

```bash
docker compose exec api-node npm install --save-dev eslint
```

Создать `backends/node/.eslintrc.json`:

```json
{
  "env": { "node": true, "es2022": true },
  "extends": "eslint:recommended",
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "rules": {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Step 3: Проверить, что в `frontend/package.json` есть `lint` и `typecheck`**

Read: `frontend/package.json`. У Nuxt 4 обычно есть оба скрипта. Если нет — добавить.

- [ ] **Step 4: Создать workflow CI**

Create: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  backend-lint:
    name: Backend (Node.js) lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backends/node/package-lock.json
      - name: Install
        working-directory: backends/node
        run: npm ci
      - name: Lint
        working-directory: backends/node
        run: npm run lint
      - name: Test
        working-directory: backends/node
        run: npm test

  frontend-lint:
    name: Frontend (Nuxt) lint & typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - name: Install
        working-directory: frontend
        run: npm ci
      - name: Lint
        working-directory: frontend
        run: npm run lint
      - name: Typecheck
        working-directory: frontend
        run: npm run typecheck
```

- [ ] **Step 5: Локально проверить lint и тесты бэка**

```bash
docker compose exec api-node npm run lint
docker compose exec api-node npm test
```

Expected: обе команды завершаются с exit code 0.

- [ ] **Step 6: Локально проверить lint и typecheck фронта**

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
```

Expected: обе команды завершаются с exit code 0. Если есть варнинги/ошибки — исправить.

- [ ] **Step 7: Закоммитить, запушить, открыть PR**

```bash
git add .github/workflows/ci.yml backends/node/ frontend/
git commit -m "ci: добавлен workflow lint+test для бэка и фронта"
git push -u origin feature/sprint-0-ci
```

Открыть PR. Проверить: в PR появились два check’а — `Backend (Node.js) lint` и `Frontend (Nuxt) lint & typecheck`. Оба зелёные.

- [ ] **Step 8: Включить required status checks**

В GitHub UI: Settings → Branches → branch protection rule на `main` → отметить `Require status checks to pass before merging` → добавить два check’а из CI как обязательные.

---

## Task 8: Заменить README и CLAUDE.md под наш проект

**Цель:** новые разработчики, открыв репо, понимают что это за проект, как его поднять и где документация.

**Files:**
- Modify: `README.md` (полностью переписать)
- Modify: `CLAUDE.md` (полностью переписать)

- [ ] **Step 1: Создать ветку**

```bash
git checkout main
git pull origin main
git checkout -b feature/sprint-0-readme
```

- [ ] **Step 2: Переписать `README.md`**

Replace: содержимое `README.md` на:

```markdown
# Support Chat Hub for Bitrix24

R&D-приложение для Маркета Битрикс24. Превращает email-переписку B2B-саппорта в обычный чат-канал внутри штатных Открытых линий.

## Гипотеза

Подробнее — в [docs/superpowers/specs/2026-05-25-support-chat-hub-design.md](docs/superpowers/specs/2026-05-25-support-chat-hub-design.md).

## Стек

- Backend: Node.js 20 + Express 5
- Frontend: Nuxt 4 + `@bitrix24/b24jssdk-nuxt`
- БД: Postgres 17
- Очередь (с Sprint 4): RabbitMQ
- Основа: [bitrix-tools/b24-ai-starter](https://github.com/bitrix-tools/b24-ai-starter) (только Node.js-вариант)

## Локальный запуск

См. [docs/local-dev.md](docs/local-dev.md) и [docs/setup-test-portal.md](docs/setup-test-portal.md).

Кратко:
1. `cp .env.example .env` и заполнить (см. `docs/local-dev.md`)
2. Зарегистрировать тестовое приложение в Б24 (см. `docs/setup-test-portal.md`)
3. `make dev-node`

## Документация

- Спека и архитектура: [docs/superpowers/specs/](docs/superpowers/specs/)
- Планы спринтов: [docs/superpowers/plans/](docs/superpowers/plans/)
- ADR (архитектурные решения): [docs/adr/](docs/adr/)
- Workflow и стратегия веток: [docs/workflow.md](docs/workflow.md)
```

- [ ] **Step 3: Переписать `CLAUDE.md`**

Replace: содержимое `CLAUDE.md` на:

```markdown
# CLAUDE.md — конвенции для AI-ассистентов

Это инструкция для Claude Code / Cursor при работе с проектом.

## Что это за проект

Support Chat Hub for Bitrix24 — R&D-приложение, превращающее email в чат-канал ОЛ. Полная спека: `docs/superpowers/specs/2026-05-25-support-chat-hub-design.md`.

## Стек (зафиксирован)

- Node.js 20 + Express 5 (бэкенд, единственный — PHP и Python удалены)
- Nuxt 4 + `@bitrix24/b24jssdk-nuxt` (фронт, страница настроек)
- Postgres 17 (одна БД)
- RabbitMQ (с Sprint 4 для очереди исходящих писем)
- Docker Compose для локалки

## Правила работы

1. **Прямые коммиты в `main` запрещены.** Все изменения через PR. См. `docs/workflow.md`.
2. **TDD** для бизнес-логики (Vitest). Тесты пишутся до имплементации.
3. **Conventional Commits** для всех коммитов.
4. **Минимальный diff** — не рефакторить попутно, что не относится к задаче.
5. **Без эмодзи в коде**, только в README/докментации, если уместно.

## Где смотреть

- Текущий спринт: `docs/superpowers/plans/2026-05-25-sprint-N-*.md`
- Skills для работы с Б24: `.claude/skills/develop-b24-node/`, `.claude/skills/develop-b24-frontend/`
- Документация по Б24 REST API: `instructions/bitrix24/`

## Команды

- `make dev-node` — поднять локальный стек
- `make down` — остановить всё
- `docker compose logs api-node -f` — логи бэкенда
- `docker compose exec api-node npm test` — запустить тесты бэкенда
```

- [ ] **Step 4: Закоммитить и запушить**

```bash
git add README.md CLAUDE.md
git commit -m "docs: переписать README и CLAUDE.md под наш проект"
git push -u origin feature/sprint-0-readme
```

Открыть PR, дождаться CI (должен пройти, мы только доку меняли), смержить.

---

## Task 9: Финальная приёмка Sprint 0

**Цель:** убедиться, что все AC из мастер-плана выполнены.

**Files:** Нет изменений в коде — это финальная проверка.

- [ ] **Step 1: Проверить AC S0.1 (PHP и Python удалены)**

```bash
ls backends/
```

Expected: только `node/`. Никаких `php/`, `python/`.

- [ ] **Step 2: Проверить AC S0.2 (`make dev-node` поднимает стек)**

```bash
make down
make dev-node
docker compose ps
```

Expected: все сервисы (`database-postgres`, `api-node`, `frontend`) — `Up` и `healthy`.

- [ ] **Step 3: Проверить AC S0.3 (OAuth install работает)**

В тестовом портале: удалить приложение → переустановить → запись в `bitrix24account` появилась.

- [ ] **Step 4: Проверить AC S0.5 (страница настроек в iframe рендерит «Привет, домен»)**

Открыть приложение в портале → видеть приветствие.

- [ ] **Step 5: Проверить AC S0.6 (CI работает)**

В GitHub: создать тестовый PR с дамми-изменением → видеть, что оба check’а проходят → закрыть PR без merge.

- [ ] **Step 6: Проверить AC S0.7 (README и CLAUDE.md обновлены)**

Открыть `README.md` и `CLAUDE.md` — отражают наш проект, не стартер.

- [ ] **Step 7: Финализировать спринт**

Если все 6 AC выполнены — Sprint 0 закрыт. Отметить в task tracker, обновить master plan статусом «Sprint 0: ✅ done», провести короткую ретроспективу (5–10 минут): что заняло дольше / короче оценки, какие риски обнаружились, что скорректировать в Sprint 1.

Зафиксировать ретроспективу в `docs/superpowers/plans/2026-05-25-sprint-0-retro.md`.

---

## Известные ограничения и сделанные сознательно компромиссы

- **`.env` хранит секреты в открытом виде** на машине разработчика. Для R&D приемлемо. Production-секреты будут в окружении хостинга.
- **CloudPub-туннель** даёт publicly accessible URL для дев-машины. Стартовый туннель бесплатный, но имеет лимиты. Это OK для одиночной R&D-разработки.
- **Шифрование токенов не реализовано в Sprint 0.** Тоны хранятся в БД как plain text. Это **сознательный компромисс** — шифрование добавим в Sprint 1 (FR/NFR-2), когда будем хранить ещё и пароли IMAP/SMTP.
- **Authentication для `/api/install` endpoint** не реализована (нет валидации `application_token` от Б24). Добавим в Sprint 3 или Sprint 5 (вместе с webhook’ами от ОЛ, где валидация критична).
- **CI не запускает реальные интеграционные тесты с Postgres.** Только unit + lint. Интеграционные тесты в CI — Sprint 5.
- **Никакой Telemetry / OpenTelemetry** не настраивается, хотя стартер её приносит. Оставляем выключенной, чтобы не возиться с OTLP-экспортёром локально.

## Что НЕ делает Sprint 0 (negative scope)

- Никакой email-логики (IMAP, SMTP, парсинг).
- Никакой работы с Открытыми линиями (`imconnector.*`, `imopenlines.*`).
- Никакой формы подключения ящика (это Sprint 1).
- Никакой страницы со списком диалогов / сообщений (мы это вообще не строим — используем штатный Чат портала).
