# Минимальный образ Yandex-прокси для деплоя в Yandex Cloud.
#
# Сборка (из корня репозитория):  docker build -t kniga-proxy ./server
# Локальный запуск:
#   docker run --rm -p 3001:3001 \
#     -e PORT=3001 -e YANDEX_API_KEY=... -e YANDEX_FOLDER_ID=... \
#     kniga-proxy
#
# Ключи передаются ТОЛЬКО через переменные окружения (в образ не копируются).
# Порт контейнеру сообщает облако через переменную PORT.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY server.js smoke-test.js ./
EXPOSE 3001
CMD ["node", "server.js"]
