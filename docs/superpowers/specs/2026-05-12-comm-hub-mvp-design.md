# ТЗ. Центр коммуникаций для Битрикс24 — MVP

**Версия:** 1.0 (дизайн-документ для проверки гипотезы)
**Дата:** 2026-05-12
**Статус:** draft, ожидает утверждения

---

## 1. Гипотеза и цель MVP

**Гипотеза:**

> Оператор может вести переписку со всеми клиентами портала Битрикс24 (любые подключённые Открытые линии + корпоративная почта) в одном окне отдельного приложения, при необходимости подключив бота к любой из линий.

**Цель MVP — проверить эту гипотезу с минимально жизнеспособной реализацией.** Всё, что не нужно для подтверждения гипотезы, отложено в Phase 2.

**Тип приложения:** тиражируемое для Битрикс24.Маркет (облако + коробка).
**Модель распространения:** приложение в Маркете, OAuth-серверное, многотенантное.

---

## 2. Функциональные границы

### 2.1. Что входит в MVP

1. **Inbox оператора** — единый интерфейс со списком диалогов всех ОЛ портала (включая email-канал), окно переписки, ответ.
2. **Email-канал как Custom Connector к ОЛ** — 1 IMAP/SMTP-ящик на портал. Входящие письма попадают в ОЛ как сообщения коннектора; ответы оператора уходят SMTP.
3. **Один встроенный бот** (OpenClaw-агент через VibeCode-платформу). Конфигурация: системный промпт + до 50 FAQ-пар (Q→A). Подключается к выбранным ОЛ галочками. Режим работы: «приветствие + нерабочее время + handoff оператору».
4. **Single Sign-On через Bitrix24 OAuth.** Право доступа к приложению — у пользователей с доступом к Открытым линиям портала.

### 2.2. Что НЕ входит в MVP (явный negative scope)

| Откладывается                                           | Причина                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Несколько почтовых ящиков на портал                     | Усложняет UI и роутинг, не блокирует проверку гипотезы                                             |
| OAuth-почта (Gmail, Microsoft 365)                      | Каждый провайдер = отдельная верификация и review; IMAP+SMTP покрывает 90% B2B-кейсов              |
| HTML-форматирование писем, inline-картинки              | Plain text + текстовые/файловые вложения. HTML, если есть, конвертируем в plain                    |
| CC/BCC, Reply-To, headers                               | Связь сообщений через свой `email_message_map`                                                     |
| Привязка письма к произвольной CRM-карточке             | Только штатный механизм OL→CRM (создание Лида или поиск Контакта по email)                         |
| Дублирование письма в `CRM_EMAIL` Activity              | В CRM-карточке диалог отображается как чат-сессия OL, не во вкладке «Почта». Явное ограничение MVP |
| Несколько ботов / конструктор сценариев                 | Один бот на портал, без визуального конструктора                                                   |
| RAG с загрузкой файлов, веб-краулинг                    | Только Q→A FAQ-пары                                                                                |
| Suggested-reply для оператора                           | Бот отвечает сам в чате                                                                            |
| Whisper (транскрипция голосовых)                        | Phase 2                                                                                            |
| Web Search для бота                                     | Phase 2                                                                                            |
| WebSocket real-time                                     | Polling раз в 5 сек                                                                                |
| Аналитика, отчёты, дашборды                             | Используем встроенные отчёты OL Битрикс24                                                          |
| Темы, hotkeys, кастомизация UI                          | Один экран, минимальный стиль                                                                      |
| Сосуществование с штатным email-tracker на том же ящике | Жёсткая проверка: если ящик уже в `mailservice.mailbox.list` — отказ подключения с ошибкой         |

### 2.3. Принципиальные ограничения, которые принимаем

- **Сессия ОЛ ≠ thread письма.** Если письмо в той же теме придёт после закрытия OL-сессии (таймаут/закрытие оператором) — это будет новая OL-сессия. В клиентском почтовом клиенте — та же ветка.
- **Письмо в CRM-карточке отображается как OL-диалог**, не во вкладке «Почта». В справке приложения это явно проговаривается.
- **При падении процесса теряется in-memory очередь исходящих SMTP.** Принимаем для MVP. Phase 2: persist queue в Postgres.
- **Голосовые сообщения OL** — оператор видит файл, но без транскрипции.
- **Длинные письма (>100 КБ текста)** обрезаются до 100 КБ в OL-сообщении. Полный текст не сохраняется отдельно.

---

## 3. Стек и платформа

| Слой                | Технология                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Хостинг             | VibeCode Infra (`POST /v1/infra/servers`). Один сервер, минимальный тариф. Auto-sleep отключён через `/sleep`. URL `https://app-{id}.vibecode.bitrix24.tech`                                       |
| Backend             | Node.js 20 LTS + TypeScript 5 + Fastify 4                                                                                                                                                          |
| Frontend            | React 18 + Vite + TypeScript. SPA, отдаётся тем же Fastify по `/app`                                                                                                                               |
| ORM                 | Prisma 5                                                                                                                                                                                           |
| База данных         | Внешний managed Postgres (Supabase free tier на старте). Вынесено наружу VibeCode-инфры, потому что эфемерность Infra-серверов не подтверждена — без внешней БД невозможна миграция на свой сервер |
| Очереди             | In-memory `p-queue` на каждый IMAP/SMTP воркер. Не Redis — слишком тяжёлая зависимость для MVP                                                                                                     |
| Шифрование секретов | `libsodium` sealed box. Master key — env-переменная VibeCode-сервера                                                                                                                               |
| B24 SDK             | Прямые HTTPS-вызовы к REST порталу + Entity API VibeCode там, где есть выигрыш (Batch API)                                                                                                         |
| AI                  | VibeCode AI Router, модель `bitrix/bitrixgpt-5`. Прямой `fetch` к `/v1/chat/completions`                                                                                                           |
| Бот                 | OpenClaw (`@ihazz/bitrix24` npm-плагин), scopes `imbot`, `vibe:ai`                                                                                                                                 |
| IMAP                | `imapflow` (`imapflow` npm)                                                                                                                                                                        |
| SMTP                | `nodemailer`                                                                                                                                                                                       |
| Парсинг писем       | `mailparser`                                                                                                                                                                                       |

### 3.1. Версии и совместимость

- Битрикс24 — облако и коробка ≥ 22.0 (минимум для современной версии Open Lines REST).
- Node.js 20 LTS. Без экспериментальных флагов.

---

## 4. Архитектура

### 4.1. Общая схема

```
┌──────────────────────────────────────────────────────────────┐
│                    Битрикс24 (портал клиента)                │
│                                                              │
│  Open Lines ── Канал «Comm Hub Email» (наш Custom Connector) │
│       ↓↑                                                     │
│  Standard OL UI (operator может работать и тут)              │
│                                                              │
│  Slot LEFT_MENU ──► iframe «Центр коммуникаций»              │
│                       (наш React SPA)                        │
└────────┬───────────────────────────────┬─────────────────────┘
         │  REST + OAuth                 │ webhook events
         │                               │
         ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  VibeCode Infra (один сервер)                │
│                                                              │
│  Fastify (port 3000)                                         │
│   ├── /oauth/install     ── OAuth flow Б24                   │
│   ├── /app/*             ── статика React SPA                │
│   ├── /api/*             ── BFF для SPA                      │
│   ├── /webhooks/b24      ── приёмник событий портала         │
│   └── /webhooks/health   ── healthcheck                      │
│                                                              │
│  Background loops (в том же процессе):                       │
│   ├── imap-poller        ── setInterval 60s по каждому ящику │
│   ├── smtp-sender        ── p-queue concurrency=2            │
│   └── token-refresher    ── refresh OAuth-токенов B24        │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│   External Postgres (Supabase)                               │
│   Таблицы: portals, mailboxes, email_message_map, bot_config │
└──────────────────────────────────────────────────────────────┘

External: IMAP/SMTP-серверы клиентов, VibeCode AI Router
```

### 4.2. Внутренняя структура backend

```
src/
  domain/                       — чистая бизнес-логика, без vendor-зависимостей
    email/
      IncomingEmailHandler.ts
      OutgoingEmailHandler.ts
      EmailParser.ts            — обрезка quoted-text, plain-конверсия
    connector/
      ConnectorRegistration.ts  — регистрация коннектора в OL портала
      MessageBridge.ts          — двусторонний мост email ↔ OL
    bot/
      BotConfiguration.ts
      BotResponder.ts           — FAQ matching + LLM fallback
    portal/
      InstallFlow.ts            — OAuth + первичная настройка
  vendor/
    vibecode.ts                 — ЕДИНСТВЕННАЯ точка зависимости от VibeCode
                                  (AI Router, Infra, OpenClaw). При миграции
                                  переписываем этот файл
    b24.ts                      — единая обёртка над B24-вызовами: auth, retries,
                                  rate-limit, exponential backoff. Внутри может
                                  использовать Entity API VibeCode для batch'ей
                                  и прямой REST для специфичных методов
                                  (imconnector.*, imopenlines.*, imbot.*)
    supabase.ts                 — Prisma client + миграции
  http/
    routes/
      oauth.ts
      api.ts
      webhooks.ts
    server.ts
  workers/
    imapPoller.ts
    smtpSender.ts
  config.ts
  main.ts
```

**Правило:** ни один файл в `domain/` не импортирует из `vendor/` напрямую. Только через инжектируемые порты (простые TS-интерфейсы), которые реализуются в `vendor/`.

### 4.3. Frontend структура

```
web/
  src/
    pages/
      Inbox.tsx           — список диалогов + правая панель переписки
      Settings.tsx        — три таба: Почта / Бот / О приложении
    api/
      client.ts           — fetch к нашему BFF, проброс B24 auth-token
    components/
      DialogList.tsx
      MessagePane.tsx
      Composer.tsx
      MailboxForm.tsx
      BotForm.tsx
    App.tsx
    main.tsx
  index.html
  vite.config.ts
```

Авторизация фронтенда: при загрузке iframe Битрикс24 передаёт параметры `AUTH_ID` и `member_id`. SPA отправляет их в `/api/session`, BFF валидирует через `app.info` REST-метод портала и выдаёт свой короткоживущий JWT для последующих вызовов API.

---

## 5. Модель данных

```sql
-- 1. Установленные порталы
CREATE TABLE portals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  b24_member_id   TEXT UNIQUE NOT NULL,        -- идентификатор портала Б24
  domain          TEXT NOT NULL,                -- example.bitrix24.ru
  access_token    BYTEA NOT NULL,               -- OAuth bearer, зашифровано libsodium
  refresh_token   BYTEA NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  application_token BYTEA,                      -- Б24 `application_token` для верификации
                                                -- подписи входящих webhook (приходит вместе с
                                                -- OnAppInstall). Не путать с access_token
  installed_at    TIMESTAMPTZ DEFAULT now(),
  uninstalled_at  TIMESTAMPTZ
);

-- 2. Почтовые ящики
CREATE TABLE mailboxes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  imap_host       TEXT NOT NULL,
  imap_port       INT NOT NULL,
  imap_user       TEXT NOT NULL,
  imap_password   BYTEA NOT NULL,               -- зашифровано
  smtp_host       TEXT NOT NULL,
  smtp_port       INT NOT NULL,
  smtp_user       TEXT NOT NULL,
  smtp_password   BYTEA NOT NULL,
  use_ssl         BOOLEAN DEFAULT true,
  ol_connector_id TEXT NOT NULL,                -- ID коннектора, зарегистр. в OL
  ol_line_id      INT NOT NULL,                 -- ID линии Open Lines, к которой привязан
  last_seen_uid   INT,                          -- последний обработанный IMAP UID
  enabled         BOOLEAN DEFAULT true,
  last_error      TEXT,
  last_polled_at  TIMESTAMPTZ,
  UNIQUE(portal_id)                              -- 1 ящик на портал (явное ограничение MVP)
);

-- 3. Маппинг писем ↔ OL-сообщений
CREATE TABLE email_message_map (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id       UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  email_message_id TEXT NOT NULL,                -- Message-Id из заголовков
  email_in_reply_to TEXT,
  ol_chat_id       BIGINT NOT NULL,              -- ID чата OL
  ol_message_id    BIGINT,                       -- ID сообщения в OL (NULL для исходящих, до отправки)
  direction        TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status           TEXT NOT NULL DEFAULT 'pending',
                   -- 'pending', 'sent', 'failed'
  error            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  sent_at          TIMESTAMPTZ
);
CREATE INDEX idx_email_map_chat ON email_message_map(ol_chat_id);
CREATE INDEX idx_email_map_msgid ON email_message_map(email_message_id);

-- 4. Конфигурация бота
CREATE TABLE bot_config (
  portal_id        UUID PRIMARY KEY REFERENCES portals(id) ON DELETE CASCADE,
  enabled          BOOLEAN DEFAULT false,
  bot_b24_id       INT,                         -- ID бота на портале (от imbot.register)
  vibecode_api_key BYTEA,                       -- зашифрован
  system_prompt    TEXT NOT NULL DEFAULT '',
  faq              JSONB NOT NULL DEFAULT '[]', -- [{q, a}, ...]
  attached_ol_lines INT[] DEFAULT '{}',         -- IDs линий, к которым подключён
  handoff_after_messages INT DEFAULT 3,         -- после скольких реплик передать оператору
  worktime_only    BOOLEAN DEFAULT false        -- работать только в нерабочее время
);
```

Объём данных в MVP: ~1 КБ на портал в БД. На 100 порталов — единицы мегабайт. Supabase free tier (500 МБ) — с запасом.

---

## 6. Ключевые сценарии (data flow)

### 6.1. Сценарий A — Установка приложения и подключение почты

```
1. Пользователь устанавливает приложение из Маркета
2. B24 редиректит на /oauth/install?code=... + portal info
3. BFF обменивает code → access_token+refresh_token (POST oauth.bitrix.info/oauth/token)
4. Сохраняем portal в БД (токены шифруем sealed box)
5. Регистрируем коннектор: imconnector.register({ ICON, COMPONENT, OUTPUT_METHOD, ... })
6. Редиректим в наше приложение → страница Settings → таб «Почта»
7. Пользователь вводит: email, IMAP host/port/user/pass, SMTP host/port/user/pass, выбирает линию ОЛ
8. BFF:
   8.1. Проверяет imap-соединение (`imapflow.connect` + `LIST` мейлбоксов)
   8.2. Проверяет smtp-соединение (`nodemailer.verify`)
   8.3. Проверяет mailservice.mailbox.list — ящик не должен быть подключён к штатному email-tracker
   8.4. Шифрует пароли, сохраняет в mailboxes
   8.5. imconnector.activate({ CONNECTOR, LINE })
   8.6. Запускает imap-poller для этого ящика
9. Готово, оператор может работать
```

**Точки отказа и обработка:**

- Неверный IMAP-пароль → возврат 400 с понятной ошибкой, mailbox не создаётся.
- Ящик уже в email-tracker Б24 → 409 + ссылка на инструкцию «как отключить штатный трекер для этого ящика».
- Сетевая ошибка IMAP/SMTP (нет ответа от сервера за 10 сек) → 504 + причина.

### 6.2. Сценарий B — Входящее письмо → диалог OL

```
1. IMAP-poller через 60 сек после старта или последнего опроса:
   1.1. Подключается к ящику (imapflow.connect)
   1.2. SELECT INBOX
   1.3. SEARCH UID > last_seen_uid (или UID > 0 если первый запуск, ограничивая последними 10 письмами)
   1.4. Для каждого нового UID:
      - FETCH полное письмо
      - mailparser → структурированный объект (from, subject, text, attachments)
      - EmailParser.trimQuoted() — обрезка цитат и подписей
      - Определение клиента: from.address → ищем в email_message_map для этого ящика
        - Если есть открытый OL-chat с этим клиентом → используем его chatId
        - Если нет → создаём нового клиента в коннекторе через imconnector.send.messages
                    с user.id = email-as-id, user.name = from.name || from.address
      - imconnector.send.messages: text, attachments (как files), in_reply_to связь
      - Получаем ol_chat_id и ol_message_id из ответа
      - INSERT в email_message_map (direction=inbound, status=sent)
      - UPDATE mailboxes.last_seen_uid
   1.5. Закрываем коннект
   1.6. UPDATE mailboxes.last_polled_at
2. OL автоматически:
   - Создаёт CRM-лида (или находит контакт по email через duplicate-check)
   - Маршрутизирует диалог оператору согласно настройкам линии
3. Если линия подключена к боту (bot_config.attached_ol_lines) — OpenClaw получает сообщение и реагирует по своим правилам
4. Оператор видит диалог в стандартном OL Б24 И в нашем inbox
```

**Точки отказа:**

- IMAP коннект упал → запись в `mailboxes.last_error`, следующая попытка через 60 сек. После 5 подряд провалов — `enabled=false` и уведомление установившему приложение.
- `imconnector.send.messages` вернул rate-limit → exponential backoff, до 3 попыток.
- Атачмент > 100 МБ → пропускаем атачмент, в текст вставляем `[Файл "{name}" пропущен: слишком большой]`.

### 6.3. Сценарий C — Ответ оператора → исходящее письмо

```
1. Оператор пишет ответ в нашем UI или в стандартном OL Б24
2. Б24 шлёт webhook OnImConnectorMessageAdd с CONNECTOR_USER, CHAT, MESSAGES
3. Fastify /webhooks/b24:
   3.1. Валидирует подпись (если app_token есть)
   3.2. Находит mailbox по ol_chat_id из email_message_map
   3.3. Извлекает email клиента из связки (по предыдущему inbound в этом chat)
   3.4. Определяет тему: если есть предыдущее inbound — берём её Subject с префиксом "Re: "; иначе "Сообщение от {компания}"
   3.5. SMTP-sender.enqueue({ from: mailbox.email, to: clientEmail, subject, text, inReplyTo, attachments })
4. smtp-sender (p-queue concurrency=2):
   4.1. nodemailer.sendMail
   4.2. INSERT в email_message_map (direction=outbound, status=sent, sent_at=now)
   4.3. Если ошибка SMTP → UPDATE status=failed, error=..., и оповещение в OL-чат служебным сообщением «Письмо не отправлено: {error}»
5. Клиент получает email
```

**Точки отказа:**

- Webhook пришёл, но ящик отключен / удалён → молча игнорируем (логируем warn).
- SMTP-сервер недоступен → 3 попытки с backoff (10s/30s/120s), потом fail с уведомлением в чат.
- Ответ оператора содержит файлы → грузим через `disk.attached.get` → SMTP attachment. Лимит — 25 МБ суммарно (типичный SMTP-лимит).

### 6.4. Сценарий D — Бот отвечает в OL

```
1. Установка приложения автоматически регистрирует OpenClaw-агента
   (POST на VibeCode infra → деплой OpenClaw-плагина с нашим конфигом)
2. При сохранении настроек бота на странице Settings:
   2.1. Сохраняем bot_config в БД
   2.2. Обновляем системный промпт OpenClaw через VibeCode API:
        - system_prompt от пользователя
        - FAQ injected как «Известные ответы: {Q→A list}»
        - Инструкция «Если вопрос не из FAQ и ты не уверен — напиши `{{HANDOFF}}` чтобы передать оператору»
   2.3. К каждой линии из attached_ol_lines применяем `imopenlines.config.update`
        чтобы установить нашего бота как «бот приветствия»
3. Когда в OL приходит первое сообщение:
   3.1. OL передаёт боту через стандартный механизм OpenLines bot
   3.2. OpenClaw вызывает AI Router (model=bitrix/bitrixgpt-5)
   3.3. Если ответ содержит `{{HANDOFF}}` или handoff_after_messages достигнут
        — OpenClaw вызывает `imopenlines.bot.session.transfer` к оператору очереди
   3.4. Иначе — пишет ответ в чат через `imbot.message.add`
4. Worktime_only=true → бот отвечает только в нерабочее время (проверка через `timeman.status`)
```

**Точки отказа:**

- VibeCode AI Router rate-limit (429) → бот пропускает ход, OL автоматически передаёт оператору.
- Превышен месячный лимит токенов клиента → бот отключается, уведомление в UI «Превышена квота AI».
- Промпт+FAQ > 200 КБ → не сохраняем, ошибка валидации в UI.

---

## 7. UI приложения

### 7.1. Установка в портал

В манифесте приложения (`bitrix24-app.json`):

```json
{
  "code": "comm.hub",
  "name": "Центр коммуникаций",
  "scope": ["imopenlines", "imconnector", "imbot", "im", "crm", "user", "disk"],
  "placement": [
    { "code": "LEFT_MENU", "handler": "/app#/inbox" },
    { "code": "SETTINGS", "handler": "/app#/settings" }
  ]
}
```

### 7.2. Экран Inbox (главный)

Двухпанельный layout:

```
┌────────────────────────┬───────────────────────────────────────┐
│ Диалоги (im.recent.get)│ Сообщения (im.dialog.messages.get)    │
│                        │                                       │
│ ▣ Иванов И.И.    14:30 │ ─── Иванов И.И. ───                   │
│   Здравствуйте, у меня │                                       │
│                        │ Иванов:                               │
│ ▣ support@acme.ru13:15 │ Здравствуйте, у меня вопрос по...     │
│   Re: счёт №321        │                                  14:30│
│                        │                                       │
│ ▢ Telegram юзер  12:00 │ Вы:                                   │
│   Спасибо!             │ Добрый день! Сейчас уточню...         │
│                        │                                  14:31│
│                        │                                       │
│                        ├───────────────────────────────────────┤
│                        │ [✎ Введите ответ...]      📎 [Отправить]│
└────────────────────────┴───────────────────────────────────────┘
```

Список диалогов получается через `im.recent.get`, фильтруется по типу `(type === 'lines')`. Открытие диалога → `im.dialog.messages.get`. Отправка → `im.message.add`. Polling раз в 5 сек.

Никаких ярлыков, тегов, фильтров, поиска, аватаров с инициалами. Только базовый layout.

### 7.3. Экран Settings

Три таба:

**Таб «Почта»** — форма подключения ящика. При уже подключённом — статус, кнопки «Тест соединения», «Отключить», «Изменить пароль».

**Таб «Бот»**:

- Switch «Включить бота»
- Textarea «Системный промпт»
- Список FAQ-пар с add/remove (Q + A, до 50 штук)
- Multi-select «Подключить к линиям» (из `imopenlines.config.list.get`)
- Number input «Передать оператору после N реплик» (default 3)
- Switch «Только в нерабочее время»
- Input «API-ключ VibeCode» (BYOK)
- Кнопка «Тест бота» — отправляет тестовый запрос к AI Router с ключом

**Таб «О приложении»** — версия, дата установки, ссылка на справку, кнопка «Удалить и отозвать доступ».

---

## 8. Безопасность

1. **Все секреты в БД зашифрованы libsodium sealed box.** Master key — env-переменная VibeCode-сервера, не коммитится.
2. **OAuth-токены Б24 живут 1 час**, refresh — за 5 минут до истечения. Background loop `token-refresher` каждые 30 минут.
3. **Webhook B24 → нашему серверу:** валидация `application_token` из заголовка. Без токена — 401.
4. **SPA → BFF:** при первой загрузке iframe валидация через `app.info` (передаваемые AUTH_ID + member_id должны разрешать вызов app.info на портале). Затем — короткоживущий JWT (15 минут) от BFF.
5. **Без логирования паролей и токенов**, даже в DEBUG.
6. **CORS:** разрешён только домен портала, для которого выпущен JWT.
7. **IMAP/SMTP пароли никогда не возвращаются на frontend** — только пометка «••••• сохранён».
8. **CSP в SPA:** запрет inline-скриптов, только наш origin + b24cdn.

---

## 9. Развёртывание

### 9.1. CI/CD

- Репозиторий GitHub. На каждый push в `main` — GitHub Action:
  1. `npm ci && npm run test` (unit-тесты домена)
  2. `npm run build` (vite build + tsc для backend)
  3. Архивирование репозитория в tar.gz
  4. Загрузка артефакта в место, откуда VibeCode умеет деплоить (S3 / GitHub Release)
  5. POST `/v1/infra/servers/{id}/deploy` с указанием артефакта
- Миграции БД — `prisma migrate deploy` в startup-скрипте до запуска Fastify. Безопасно потому, что MVP-инстанс один (single replica на VibeCode-сервере). При переходе на multi-replica миграции выносим в отдельный pre-deploy job.

### 9.2. Конфигурация

ENV-переменные на VibeCode-сервере:

- `DATABASE_URL`
- `B24_CLIENT_ID`, `B24_CLIENT_SECRET` (для OAuth выпуск из bitrix24.market)
- `VIBECODE_API_KEY` (для управления самой инфрой и для AI Router на наших ключах в тестах)
- `MASTER_ENCRYPTION_KEY`
- `APP_BASE_URL` (https://app-{id}.vibecode.bitrix24.tech)
- `NODE_ENV=production`

### 9.3. Мониторинг

- Healthcheck эндпоинт `/healthz` → проверяет коннект к БД и AI Router.
- Логирование структурное (pino) в stdout, VibeCode-Infra собирает.
- Алерт на error-rate > 5% за 5 минут — Phase 2 (на MVP — ручная проверка логов).

### 9.4. Стратегия тестирования

Тестируем уровнями. На MVP стремимся к ~60% покрытия доменного кода, интеграционные тесты — на критические пути.

**Unit-тесты (Vitest):**

- `domain/email/EmailParser.ts` — обрезка цитат, конверсия HTML→plain, парсинг адресов. Несколько примеров реальных писем (Outlook reply, Gmail reply, цепочка переписки).
- `domain/connector/MessageBridge.ts` — корректное определение направления, идемпотентность повторной обработки одного UID.
- `domain/bot/BotResponder.ts` — FAQ-matching (точное / нечёткое), правила handoff, проверка `{{HANDOFF}}`-маркера.

**Integration-тесты (Vitest + testcontainers):**

- Поднятие Postgres в Docker → миграции Prisma → проверка CRUD по моделям.
- Mock IMAP-сервер (`smtp-server` + `imap-server` пакеты) → end-to-end: письмо → парсер → запись в БД → mock OL-API.
- Mock SMTP — проверка корректного формирования заголовков (In-Reply-To, References).

**Контрактные тесты vendor-адаптеров:**

- `vendor/b24.ts` — записанные cassette'ы реальных REST-ответов B24 (recorded fixtures), прогон offline. Pact-style.
- `vendor/vibecode.ts` — то же для AI Router.

**Ручное приёмочное (manual QA по чеклисту секции 11):**

- Тестовый портал Б24 (бесплатная пробная версия).
- Тестовые почтовые ящики: 2 шт. (один — наш, другой — клиента-симулятора).
- Прогон 7 пунктов критериев приёмки перед каждым релизом.

**Чего НЕ делаем на MVP:**

- E2E через Playwright (UI стабилизируется — добавим в Phase 2).
- Нагрузочные тесты.
- Mutation testing.

---

## 10. Критические риски, требующие спайка перед началом реализации

Эти 6 пунктов **обязательны** к проверке в первую неделю. Без подтверждённых ответов реализация может зайти в тупик. Каждый — отдельная задача в plan'е.

| #   | Риск                                                                                                                                                           | Как проверяем                                                                                                       | План Б                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Возможны ли webhook-приёмы извне на VibeCode Infra (Б24 → `https://app-{id}.../webhooks/b24`)?                                                                 | Тестовое приложение: вызов `event.bind` → провокация события в Б24 → проверка лога                                  | Если нет — переключение на polling B24 events через `event.offline.list`. Латентность ~30 сек, приемлемо для MVP                                  |
| R2  | Persistent FS на Infra-сервере (для логов, временных файлов IMAP)                                                                                              | Деплой → запись в `/tmp` → redeploy → чтение                                                                        | Если нет — всё, что persistent, в Postgres или внешний S3                                                                                         |
| R3  | Auto-sleep блокирует IMAP-poller и webhook-приём                                                                                                               | Документация `/sleep` API, проверка флага                                                                           | Если нельзя отключить полностью — внешний пинг каждые N минут (cron-job.org)                                                                      |
| R4  | Outbound networking разрешён на произвольные хосты:порты (993, 465, 587)?                                                                                      | Тест IMAP-коннекта к Яндекс/Mail.ru с Infra-сервера                                                                 | Если ограничения — публикация требований к IMAP-провайдеру (`SMTP relay`)                                                                         |
| R5  | OpenClaw в многотенантной модели: один экземпляр на VibeCode обслуживает N порталов, или нужен экземпляр на портал? Корректно ли пробрасываются tenant-токены? | Установка OpenClaw, добавление 2 тестовых порталов, проверка изоляции (бот портала A не отвечает в чатах портала B) | Если деплой на портал — переходим к ручному `imbot.register` per-portal, теряем готовый AI-мост. Если деплой шарится — пишем явный tenant-роутинг |
| R6  | Лимиты Supabase free tier (500 МБ, 60 conn) хватает на ~500 порталов?                                                                                          | Расчёт: ~10 КБ на портал × 500 = 5 МБ. Connection pool через PgBouncer                                              | Если упрётся — переезд на Neon или платный Supabase                                                                                               |

**Если хоть один из R1-R5 проваливается с фатальным результатом** — пересматриваем секцию 3 (стек) до начала реализации.

---

## 11. Критерии приёмки MVP

Гипотеза считается подтверждённой, когда на тестовом портале все 6 пунктов выполняются:

1. ✅ Приложение устанавливается из Маркета (пусть и draft-mode) в 1 клик.
2. ✅ Подключение IMAP/SMTP-ящика работает; ошибки валидации понятны.
3. ✅ Письмо извне (отправленное вручную с другого ящика) появляется:
   - в нашем Inbox UI — за ≤ 90 секунд;
   - в стандартном OL Б24 — одновременно;
   - в CRM создан лид/найден контакт.
4. ✅ Ответ оператора, написанный в нашем UI, приходит клиенту на email за ≤ 30 секунд после нажатия «Отправить». Тред в почтовом клиенте сохраняется (правильный In-Reply-To).
5. ✅ В Inbox отображаются диалоги ≥ 2 разных каналов (email + хотя бы один: Telegram/WhatsApp/виджет сайта).
6. ✅ Бот настроен с 3 FAQ-парами и системным промптом «отвечай вежливо, не выдумывай». Из 3 тестовых вопросов:
   - 2 совпадающих с FAQ — отвечает корректно;
   - 1 не из FAQ — корректно передаёт оператору с `{{HANDOFF}}`.
7. ✅ Удаление приложения с портала — корректно: коннектор деактивируется, бот удаляется, в нашей БД portal помечается uninstalled.

---

## 12. Что после MVP (Phase 2, для контекста)

Перечислены здесь, чтобы при реализации MVP не сделать выбор, который их заблокирует:

- Несколько ящиков на портал → нужен `mailbox_id` в email_message_map (уже есть)
- OAuth-почта Gmail/MS365 → ещё одна таблица `mailbox_oauth_credentials`
- Дублирование письма в CRM_EMAIL Activity → отдельный sync-worker
- RAG с файлами → таблица `kb_chunks`, миграция на Postgres с pgvector
- Whisper для голосовых → новый worker, не требует изменений модели
- Persistent SMTP queue → таблица `outbound_queue`
- WebSocket вместо polling → меняем только `/api/inbox/updates` на `wss://` endpoint
- Миграция с VibeCode на свой сервер → переписываем `src/vendor/vibecode.ts`, остальной код не меняется

---

## 13. Открытые вопросы (не блокирующие)

- Как локализуем UI? На MVP — только русский. EN — Phase 2.
- Цена в Маркете? Бесплатно на этапе валидации гипотезы, в дальнейшем — подписка.
- Юридическая модель (оферта, политика обработки ПД) — отдельный документ, не часть этого ТЗ.
- Поддержка коробочных порталов на старой версии (< 22.0) — не поддерживаем явно.

---

## 14. Оценка трудозатрат

При корректных ответах на R1–R6 в течение первой недели:

| Блок                                              | Трудозатраты (чел-недель, middle+) |
| ------------------------------------------------- | ---------------------------------- |
| Спайк R1–R6                                       | 1                                  |
| OAuth + установка + регистрация коннектора        | 0.5                                |
| IMAP-poller + SMTP-sender + message mapping       | 1.0                                |
| Inbox UI (двухпанель, polling)                    | 1.0                                |
| Settings UI (3 таба)                              | 0.5                                |
| Бот: OpenClaw + конфиг + handoff                  | 1.0                                |
| Безопасность (шифрование, JWT, валидация webhook) | 0.5                                |
| CI/CD + первый прод-деплой                        | 0.5                                |
| Тестирование критериев приёмки + багфикс          | 1.0                                |
| **Итого**                                         | **~7 чел-недель**                  |
