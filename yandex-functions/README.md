# Yandex Cloud Functions — YandexGPT + YandexART

Три функции-обработчика (без Docker, деплой ZIP-архивом через веб-консоль):

| Файл | Точка входа | Что делает |
|---|---|---|
| `health.js` | `health.handler` | Health-чек, без внешних вызовов — проверить, что деплой работает |
| `generate-text.js` | `generate-text.handler` | YandexGPT → `{ result }` |
| `generate-image.js` | `generate-image.handler` | YandexART (async: operation id → поллинг) → `{ dataUrl }` |

Общая логика (env, CORS, поллинг) вынесена в `lib.js` — он **обязательно** должен
лежать в архиве рядом с каждым handler'ом.

Ключи `YANDEX_API_KEY` / `YANDEX_FOLDER_ID` читаются из `process.env` и задаются в
консоли при создании версии функции. В код и в архив секреты не попадают.

---

## 1. Собрать ZIP

Каждой функции нужен `node-fetch`, поэтому сначала ставим зависимости, затем
архивируем **всё содержимое папки** (включая `node_modules`):

```bash
cd yandex-functions
npm install                      # появится node_modules/node-fetch
# macOS / Linux:
zip -r ../kniga-functions.zip . -x "README.md"
# Windows (PowerShell):
#   Compress-Archive -Path * -DestinationPath ..\kniga-functions.zip
```

В архиве должны оказаться: `health.js`, `generate-text.js`, `generate-image.js`,
`lib.js`, `package.json`, `node_modules/`.

> **Один архив — три функции.** Это самый простой путь: вы загружаете один и тот же
> `kniga-functions.zip` в три разные функции и для каждой указываете свою точку входа.
> (Альтернатива — три отдельных ZIP, в каждом один handler + `lib.js` + `package.json`
> + `node_modules`; работает так же, просто больше копирования.)

## 2. Создать функции в консоли

Yandex Cloud → **Cloud Functions** → «Создать функцию» — и так три раза:

1. **kniga-health** → загрузить `kniga-functions.zip` →
   - Среда выполнения: `nodejs20` (подойдёт и `nodejs18`)
   - Точка входа: `health.handler`
   - Таймаут: `10 с`, память: `128 МБ`
2. **kniga-generate-text** → тот же архив →
   - Точка входа: `generate-text.handler`
   - Таймаут: `120 с`, память: `256 МБ`
3. **kniga-generate-image** → тот же архив →
   - Точка входа: `generate-image.handler`
   - Таймаут: `300 с` (генерация + поллинг может занять минуту и больше),
     память: `512 МБ` (ответ — крупный base64)

Для **каждой** функции:
- Вкладка «Переменные окружения» → добавить
  `YANDEX_API_KEY` и `YANDEX_FOLDER_ID` (и, при желании,
  `YANDEX_TEXT_MODEL` / `YANDEX_ART_MODEL`).
- Вкладка «Триггеры» → «Создать триггер» → **HTTP**. После создания триггера у
  функции появится публичный URL вида
  `https://d5dxxxxxxxxxxxxx.functions.yandexcloud.net`.

## 3. Проверить, что деплой живой

Откройте в браузере URL функции **kniga-health** — должен вернуться JSON
`{"ok":true,"configured":true,...}`. Если `configured:false` — переменные
окружения не сохранились.

## 4. Подключить фронтенд

Три URL из п. 2 передаются фронтенду при сборке через переменные окружения
(одна точка конфигурации, ничего не хардкодится):

```bash
VITE_YANDEX_HEALTH_FN_URL=https://<health>.functions.yandexcloud.net \
VITE_YANDEX_TEXT_FN_URL=https://<generate-text>.functions.yandexcloud.net \
VITE_YANDEX_IMAGE_FN_URL=https://<generate-image>.functions.yandexcloud.net \
npm run build
```

После этого приложение само обнаружит Cloud Functions через health-чек и будет
гонять YandexGPT/YandexART через них. Если переменные не заданы или функции не
отвечают, фронтенд автоматически откатится на локальный Express-прокси
(`server/`, `http://localhost:3001`), а затем — на резервные провайдеры.

## Замечания

- CORS уже обработан в `lib.js` (включая preflight `OPTIONS`): фронтенд может
  вызывать функции напрямую со своего домена, при этом в браузер ключи не попадают.
- Ошибки Yandex возвращаются как есть (HTTP 400/429/502 + текст), секреты из
  сообщений вычищаются (`redact`).
- `server/` (Express-прокси) остаётся в репозитории для других хостингов — в этом
  сценарии он не используется.
