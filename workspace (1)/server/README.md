# Yandex-прокси (YandexGPT + YandexART)

Yandex AI Studio не отдаёт CORS-заголовки — браузер не может вызвать его
напрямую. Этот Express-сервер выступает посредником и держит ключ вне браузера.

## Запуск

```bash
npm --prefix server install     # один раз
# ключи — в ../.env (шаблон: ../.env.example), они в .gitignore
npm --prefix server run server  # → http://localhost:3001
```

Проверка ключа без фронтенда: `npm --prefix server run smoke`
(прямой вызов Yandex из Node; картинка сохраняется в `server/test-image.jpg`).

## Эндпоинты

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/yandex/status` | — | `{ ok, configured }` — заданы ли ключи (без вызова API) |
| POST | `/api/yandex/generate-text` | `{ prompt, system?, temperature?, maxTokens? }` | `{ text, model, chars }` |
| POST | `/api/yandex/generate-image` | `{ prompt, seed?, ratio? }` | `{ dataUrl, mimeType }` |

- **YandexGPT**: `gpt://<folder>/yandexgpt` через `completionAsync` + поллинг операции.
- **YandexART**: `art://<folder>/yandex-art/latest` через `textToImageAsync`
  (фолбэк `imageGenerationAsync`) + поллинг операции → `imageBase64`.
- **Порт**: из переменной `PORT` (облачный контейнер передаёт сам), по умолчанию 3001.
- **Ключи**: только `process.env` / `.env`, в коде не захардкожены, в логах маскируются.

## Коды ошибок

| Код | Значение |
|---|---|
| 400 | невалидный промпт или параметры |
| 429 | rate limit (30/мин текст, 12/мин картинки) или лимит Yandex |
| 502 | ошибка Yandex API (текст — как есть, секреты вычищены) |
| 503 | ключи не настроены на сервере |
| 504 | таймаут (поллинг до 180 с) |

## Деплой

`Dockerfile` в этой папке: `node:20-alpine`, зависимости, запуск `server.js`.

```bash
docker build -t kniga-proxy ./server
docker run --rm -p 3001:3001 -e YANDEX_API_KEY=... -e YANDEX_FOLDER_ID=... kniga-proxy
```

Фронтенд находит прокси по `VITE_YANDEX_PROXY_URL` (по умолчанию — `http://localhost:3001`).
