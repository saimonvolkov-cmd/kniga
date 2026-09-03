# Серверный прокси Yandex AI Studio (Express)

Yandex AI Studio **не отдаёт CORS-заголовки**, поэтому браузер физически не может
вызвать его напрямую — это ограничение самого API, а не баг. Единственный путь —
посредник. Им служит этот Express-сервер: фронтенд ходит на
`http://localhost:3001/api/yandex/*`, а сервер уже со своим ключом вызывает Yandex.

- Ключ (`YANDEX_API_KEY`, `YANDEX_FOLDER_ID`) живёт **только в `.env` на сервере** —
  не в браузере, не в localStorage, не в репозитории (`.env` в `.gitignore`).
- Остальные провайдеры (Gemini, Hugging Face, Pollinations, Claude) работают из
  браузера напрямую, как и раньше. Правило «только через сервер» — только для Yandex.

## Запуск (нужны оба процесса)

```bash
# 1) один раз — поставить зависимость прокси
cd server && npm install && cd ..

# 2) терминал А — фронтенд (Vite dev, http://localhost:5173)
npm run dev

# 3) терминал Б — прокси (http://localhost:3001)
npm --prefix server run server        # то же, что: node server/server.js
```

Приложение само найдёт прокси на `localhost:3001` (проба
`GET /api/yandex/status`). В шапке появится индикатор:
**«Yandex настроен на сервере»** (зелёный) или **«Yandex не настроен»** (серый).

Если прокси не запущен или ключ не задан, приложение не ломается — Yandex-провайдер
считается «не настроен», и пайплайн катится по остальным провайдерам
(Gemini → Hugging Face → Pollinations → демо-движок).

## Быстрая проверка ключа (до запуска сервера)

```bash
npm --prefix server run smoke         # = node server/smoke-test.js
```

Скрипт ходит в Yandex **напрямую из Node** (тут CORS не действует): синхронный
`completion` на `yandexgpt-lite` + асинхронная генерация `yandex-art` с поллингом,
картинка сохраняется в `server/test-image.jpg`. Если печатает `УСПЕХ` — ключ и роли
`ai.languageModels.user` / `ai.imageGeneration.user` работают.

## Эндпоинты

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET  | `/api/yandex/status`        | — | `{ ok, configured, providers, model }` (без секретов, без вызова API) |
| POST | `/api/yandex/generate-text` | `{ prompt, system?, temperature?, maxTokens? }` | `{ text, model, chars }` |
| POST | `/api/yandex/generate-image`| `{ prompt, seed?, ratio? }` | `{ dataUrl, mimeType, model }` |

### YandexGPT (`/api/yandex/generate-text`)

Модель `yandexgpt` (переопределяется `YANDEX_TEXT_MODEL`), формат
`gpt://<folder>/<model>`. Асинхронный `completionAsync` → поллинг операции
(перенесён с фронтенда) → `alternatives[0].message.text`.

```bash
curl -s http://localhost:3001/api/yandex/generate-text \
  -H 'content-type: application/json' \
  -d '{"prompt":"Придумай 3 необычные идеи для стартапа в сфере путешествий."}'
```

### YandexART (`/api/yandex/generate-image`)

Асинхронная генерация: `textToImageAsync` (фолбэк `imageGenerationAsync`) → `id`
операции → поллинг `GET /operations/{id}` → `imageBase64` → dataURL.
`ratio` по умолчанию `1:1`, `mimeType: JPEG`, опциональный `seed`.

```bash
curl -s http://localhost:3001/api/yandex/generate-image \
  -H 'content-type: application/json' \
  -d '{"prompt":"a red cat, Miyazaki style","seed":50}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dataUrl?j.dataUrl.slice(0,60)+'…':j)})"
```

## Коды ошибок

| Код | Значение |
|---|---|
| 400 | невалидный запрос (нет промпта, слишком длинный, кривые параметры) |
| 404 | нет такого эндпоинта |
| 429 | rate limit (прокси: 30 текст / 12 картинок в минуту; либо лимит Yandex) |
| 502 | ошибка Yandex API (текст Yandex — как есть, но секреты вычищены) |
| 503 | ключи не настроены на сервере (`configured: false`) |
| 504 | таймаут поллинга операции |

## Надёжность и безопасность

- **Rate limiting**: скользящее окно 60 с на IP (переопределяется `RATE_*`).
- **Валидация**: тип/длина промпта, диапазоны `temperature`/`maxTokens`/`seed`/`ratio`.
- **CORS**: разрешены только локальные origins (vite 5173, статика) — Yandex при этом
  остаётся недоступен браузеру напрямую.
- **Секреты**: ключ не логируется и не попадает в ответы — исходящие тексты проходят
  через `redact()`. В репозитории ключа нет (`.env` в `.gitignore`).

## Важно про ключи

Ключ, присланный в переписке, считайте скомпрометированным: отзовите его в
Yandex Cloud → IAM → API-ключи и создайте новый прямо в `.env`.
