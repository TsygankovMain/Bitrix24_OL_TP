# ADR-0001. Берём `bitrix-tools/b24-ai-starter` как основу проекта

**Дата:** 2026-05-25
**Статус:** Принято
**Контекст:** R&D-фаза `Support Chat Hub for Bitrix24` ([спека](../superpowers/specs/2026-05-25-support-chat-hub-design.md))

## Контекст

Перед стартом R&D нужно выбрать базу проекта. Рассмотрели три варианта:

1. **Развивать существующий код в репо** (Node.js + Fastify + React + VibeCode Infra). Написан под предыдущий концепт MVP со своим Inbox UI.
2. **Официальный `bitrix-tools/b24-ai-starter`** (Nuxt 3 + Node.js Express + Postgres + RabbitMQ + Docker).
3. **Сторонние стартеры** (Symfony + b24php-lib, community Next.js шаблоны).

## Решение

Берём `b24-ai-starter`. Node.js-бэкенд из трёх предложенных в стартере (PHP / Python / Node.js).

## Обоснование

- **Multi-tenant install flow + JWT auth готовы из коробки** — экономия ~0.5 чел-недели на самом скучном куске.
- **Background workers через RabbitMQ + `amqplib`** уже в стартере — закрывает FR-C.6 (persisted-очередь исходящих) без отдельной интеграции.
- **Docker Compose + Postgres 17** — локальный старт одной командой.
- **Официальный SDK Битрикса** (`@bitrix24/b24jssdk` на фронте, Node.js SDK на бэке) — не дёргаем REST вручную.
- **Подписан вендором** `bitrix-tools` — долгосрочно обновляется вместе с эволюцией платформы.
- **AI-skills для Claude Code/Cursor** внутри стартера — совпадает с тем, как мы сейчас работаем.

Node.js-бэкенд выбран потому, что email-стек на Node (`imapflow`, `nodemailer`, `mailparser`) — best-in-class. PHP/Python заметно слабее именно в работе с почтовым форматом.

## Альтернативы и почему отвергли

- **Существующий код:** написан под другой концепт (со своим Inbox UI), большую часть пришлось бы переписывать. К тому же он завязан на VibeCode Infra, а спайки R1–R5 PENDING — реальные ограничения этой платформы не подтверждены.
- **`b24php-lib` + Symfony:** PHP-документация Битрикса богаче, но IMAP-poller на PHP требует cron+supervisor — дополнительная инфраструктура. Замедляет R&D.
- **VibeCode template:** без AI-бота уникальные преимущества платформы (AI Router, OpenClaw) не используются. Остаётся только vendor lock.

## Последствия

- Существующий код в репо архивируется в ветку `archive/2026-05-12-mvp-attempt`.
- Репо инициализируется заново на базе стартера.
- Новые зависимости: RabbitMQ (вместо in-memory очереди), Docker, Nuxt 3.
- Получаем готовую production-grade структуру (Nginx, Docker, БД, очередь).
