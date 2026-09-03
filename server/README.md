# Серверный прокси Yandex AI Studio

Браузер **никогда** не обращается к Yandex API напрямую и не видит ключ:
все запросы идут через этот сервер, ключ живёт в `.env` (в корне проекта,
файл в `.gitignore`).

Сервер написан на чистом Node.js (≥ 18) **без зависимостей** — ничего
устанавливать не нужно (Express-версия добавляется тривиально, контракты
эндпоинтов не изменятся).

## Запуск

```bash
# 1) собрать фронтенд (сервер раздаёт dist/ на том же origin)
npm run build

# 2) запустить сервер
node server/index.js
# → http://127.0.0.1:8787 — и приложение, и /api/*
```

Ключи читаются из `.env` (корень проекта или `server/`); настоящие
переменные окружения имеют приоритет. Если ключей нет, `/api/*` честно
отвечает `503`, а приложение автоматически откатывается на браузерные
провайдеры/демо-режим.

## Эндпоинты

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, providers: { yandexText, yandexImage } }` (без секретов) |
| POST | `/api/generate-text` | `{ prompt, system?, temperature?, maxTokens? }` | `{ text, model, route, chars }` |
| POST | `/api/generate-image` | `{ prompt, seed?, widthRatio?, heightRatio? }` | `{ dataUrl, mimeType }` |
| POST | `/api/generate` | `{ brief }` | GPT расширяет сцену → ART рисует: `{ prompt, dataUrl }` |

### YandexGPT (`/api/generate-text`)

Модель `yandexgpt-lite`, формат `gpt://<folder>/yandexgpt-lite`.
Основной путь — синхронный OpenAI-совместимый REST
`POST https://ai.api.cloud.yandex.net/v1/responses`
(`temperature`, `max_output_tokens`). Если маршрут недоступен —
проверенный асинхронный `completionAsync` + поллинг операции.

```bash
curl -s http://127.0.0.1:8787/api/generate-text \
  -H 'content-type: application/json' \
  -d '{"prompt":"Придумай 3 необычные идеи для стартапа в сфере путешествий.","temperature":0.8,"maxTokens":1000}'
```

### YandexART (`/api/generate-image`)

Асинхронная генерация: `textToImageAsync` (фолбэк `imageGenerationAsync`)
→ `id` операции → поллинг `GET /operations/{id}` → `imageBase64`.
Параметры `ratio` (по умолчанию `1:1`), `mimeType: image/jpeg`,
опциональный `seed`.

```bash
curl -s http://127.0.0.1:8787/api/generate-image \
  -H 'content-type: application/json' \
  -d '{"prompt":"a red cat, Miyazaki style","seed":50}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dataUrl?.slice(0,60)+'…'??j)})"
```

## Коды ошибок

| Код | Значение |
|---|---|
| 400 | невалидный запрос (нет промпта, промпт длиннее 6000 символов, кривой JSON, параметры вне диапазона) |
| 404 | нет такого эндпоинта |
| 429 | rate limit (свой — `Retry-After` в заголовке; либо лимит Yandex) |
| 502 | ошибка Yandex API (текст ошибки Yandex — как есть, но секреты вычищены) |
| 503 | ключи не настроены на сервере |
| 504 | таймаут (GPT 90 с, поллинг ART до 180 с) |

## Надёжность и безопасность

- **Retry**: 1 повтор на временные ошибки (сеть, таймаут, 5xx, 429) с паузой 0.9 с.
- **Rate limiting**: скользящее окно 60 с на IP — 30/мин текст, 12/мин картинки,
  8/мин комбо, 90/мин всего (переопределяется переменными `RATE_*`).
- **Валидация**: тип и длина промпта, диапазоны `temperature`/`maxTokens`/`seed`/`ratio`,
  лимит тела запроса 200 КБ.
- **CORS**: same-origin (статика раздаётся с того же порта) + `localhost:*`;
  дополнительные домены — через `CORS_ORIGIN=a,b`.
- **Секреты**: ключ не логируется и не попадает в ответы — все исходящие
  тексты проходят через `redact()`. В репозитории ключа нет (`.env` в `.gitignore`).

## Фронтенд

При открытии через этот сервер приложение само обнаруживает бэкенд
(`GET /api/health`) и переводит YandexGPT/YandexART на `/api/*` — в шапке
появляется зелёный стикер «бэкенд /api активен». Без сервера всё работает
как раньше (браузерные провайдеры по ключам из настроек или демо-режим).

## Важно про ключи

Ключ, присланный в переписке, считайте скомпрометированным: отзовите его
в Yandex Cloud → IAM → API-ключи и создайте новый прямо в `.env`.
