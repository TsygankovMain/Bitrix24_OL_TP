# Comm Hub — Bitrix24 Marketplace App

MVP для проверки гипотезы: единый inbox для Открытых линий Битрикс24, один IMAP/SMTP ящик как custom connector и один AI-бот с FAQ/handoff.

- ТЗ: `docs/superpowers/specs/2026-05-12-comm-hub-mvp-design.md`
- План: `docs/superpowers/plans/2026-05-12-comm-hub-mvp-plan.md`
- Спайки: `docs/spike-report.md`

## Local Development

```bash
npm install
npm run test
npm run build
```

Для реального запуска нужны значения из `.env.example`, тестовый портал Битрикс24 и VibeCode key.
