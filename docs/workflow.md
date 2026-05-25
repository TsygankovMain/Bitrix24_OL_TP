# Workflow разработки

**Дата:** 2026-05-25
**Статус:** Действует на R&D-фазу. Пересмотр при росте команды или выходе в Маркет.

## Стратегия веток — GitHub Flow

Одна долгоживущая ветка `main` + короткие feature-branches.

```
main  ─────●──●──●──●──●──── (всегда «зелёная», автодеплой на staging)
            \    /  \    /
             feature/A  feature/B (1–3 дня жизни, merge через PR)
```

- `main` — всегда работоспособное состояние. Прямые коммиты запрещены.
- `feature/<short-name>` — короткие ветки под одну фичу или один спринтовый таск. Живут 1–3 дня.
- `fix/<short-name>` — короткие ветки под багфикс или хотфикс.
- `archive/*` — снэпшоты, которые мы хотим сохранить, но больше не развиваем (например, `archive/2026-05-12-mvp-attempt`).

### Правила

1. **Прямой push в `main` запрещён.** Все изменения — через Pull Request.
2. **PR должен пройти CI и code review** (review делает Claude в формате `code-review` skill + сам разработчик).
3. **После merge ветка удаляется** (squash merge включён).
4. **Релизы — через git tags** в формате `vX.Y.Z` (semver). Например, `v0.1.0` для первого пилотного релиза.

## Окружения деплоя

| Окружение | Что туда деплоится | Как |
|---|---|---|
| **Local** | Любая ветка | `docker-compose up` на машине разработчика |
| **Staging** | Каждый коммит в `main` | Автодеплой через CI (настроим в Sprint 1) |
| **Production** | Тэги `vX.Y.Z` | Ручной триггер CI с указанием тэга |

**Конфигурация окружений** отличается env-переменными (Б24-приложение, БД, ключи) — не веткой. Один и тот же код запускается во всех трёх окружениях с разными `.env`.

## Конвенция коммитов

[Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/):

- `feat: ...` — новая функциональность
- `fix: ...` — багфикс
- `docs: ...` — изменения только в документации
- `chore: ...` — рутина (зависимости, конфиги, очистка)
- `refactor: ...` — рефакторинг без изменения поведения
- `test: ...` — добавление тестов

Тело коммита — на русском, заголовок — на английском (стандарт CC).

## Что нужно настроить вручную в GitHub

(Сделать через UI [github.com/TsygankovMain/Bitrix24_OL_TP/settings/branches](https://github.com/TsygankovMain/Bitrix24_OL_TP/settings/branches))

1. **Branch protection rule на `main`:**
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1 (минимум — для R&D одного разработчика можно self-approval через ревью от Claude или временно отключить)
   - ✅ Require status checks to pass (после настройки CI)
   - ✅ Require branches to be up to date before merging
   - ✅ Restrict who can push to matching branches → пусто (никто, кроме админа в крайнем случае)
2. **Squash merge only** в Settings → General → Pull Requests:
   - ✅ Allow squash merging
   - ❌ Allow merge commits
   - ❌ Allow rebase merging
   - ✅ Automatically delete head branches

## Когда меняем правила

- При появлении 2-го разработчика — добавляем обязательное peer review.
- При выходе в Маркет — добавляем `release/*` ветку для подготовки релизов и canary-деплоя.
- При появлении нескольких клиентов в проде — переходим на trunk-based с feature flags.
