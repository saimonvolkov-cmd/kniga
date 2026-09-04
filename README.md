# Сказка про меня — персональная книга для ребёнка

MVP-пайплайн: опрос из 9 шагов → генерация истории (Story JSON) → модерация →
иллюстрации → вёрстка с текстовыми баннерами → вертикальная «книга» скроллом →
скачивание PDF.

## Быстрый старт

```bash
npm install
npm run dev                 # фронтенд (vite)
```

Чтобы включить Yandex-провайдера (история — YandexGPT, картинки — YandexART):

```bash
# 1) заполните ключи: скопируйте .env.example → .env
npm --prefix server install # один раз — поставить express
npm --prefix server run server
# → Yandex-прокси запущен: http://localhost:3001 · Yandex настроен на сервере ✓
```

Приложение само найдёт прокси (индикатор в шапке позеленеет без перезагрузки).
Yandex API не отдаёт CORS, поэтому ключ живёт только в серверном `.env` и в
браузер не попадает. Проверить ключ отдельно: `npm --prefix server run smoke`.

Без прокси приложение работает на запасных провайдерах (Gemini / Hugging Face
по ключам из настроек, Pollinations — бесплатно без ключа) или на локальном
демо-движке.

## Прод — Yandex Cloud Functions (без Docker)

Основной путь деплоя: три функции в `yandex-functions/` (`generate-text`,
`generate-image`, `health`) загружаются ZIP-архивом через веб-консоль — Docker не
нужен. Пошаговая инструкция: [`yandex-functions/README.md`](yandex-functions/README.md).

После деплоя фронтенд собирается с тремя URL функций (одна точка конфигурации):

```bash
VITE_YANDEX_HEALTH_FN_URL=https://<health>.functions.yandexcloud.net \
VITE_YANDEX_TEXT_FN_URL=https://<text>.functions.yandexcloud.net \
VITE_YANDEX_IMAGE_FN_URL=https://<image>.functions.yandexcloud.net \
npm run build
```

## Прод — альтернатива: Docker / локальный прокси

```bash
npm run build               # фронтенд в dist/
docker build -t kniga-proxy ./server
docker run --rm -p 3001:3001 -e YANDEX_API_KEY=... -e YANDEX_FOLDER_ID=... kniga-proxy
```

Адрес прокси для фронтенда — одна переменная `VITE_YANDEX_PROXY_URL`
(по умолчанию опрашивается `http://localhost:3001`). Cloud Functions имеют
приоритет; если они не заданы/не отвечают, фронтенд откатывается на прокси.

## Структура

- `src/lib/storyEngine.ts` — Narrative Module (Story JSON, карта героя)
- `src/lib/illustrator.ts` — Illustration Module (демо-SVG сцены, промпты)
- `src/lib/safety.ts` — Content Safety (ALLOW/BLOCK + смягчение)
- `src/lib/pdf.ts` — Export Module (pdf-lib, кириллица через canvas)
- `src/lib/api.ts` — провайдеры: Yandex (Cloud Functions / прокси) / Claude / Gemini / HF / Pollinations
- `yandex-functions/` — Yandex Cloud Functions: YandexGPT + YandexART + health (ключи из env)
- `server/server.js` — Express-прокси Yandex AI Studio (PORT из env, без ключей в коде)
