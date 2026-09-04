"use strict";
/* YandexART — генерация изображения. Точка входа: generate-image.handler
   Запрос : POST { prompt, seed?, ratio? }
   Ответ  : 200 { dataUrl, mimeType, model }   (dataUrl: "image/jpeg;base64,…")
   Логика асинхронного ожидания (operation id → поллинг GET /operations/{id})
   перенесена из server/index.js без изменений.
   Ключи  : YANDEX_API_KEY / YANDEX_FOLDER_ID из process.env. */
const {
  BASE, env, configured, yandexHeaders, parseBody,
  isPreflight, preflightResponse, ok, fail, extractYandexError, pollOperation, fetch,
} = require("./lib");

exports.handler = async (event) => {
  if (isPreflight(event)) return preflightResponse();
  if (!configured())
    return fail(503, "Yandex не настроен: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID в переменных окружения функции");

  const { prompt, seed, ratio } = parseBody(event);
  if (typeof prompt !== "string" || !prompt.trim()) return fail(400, "prompt обязателен и должен быть непустой строкой");
  if (prompt.length > 4000) return fail(400, "prompt длиннее 4000 символов");

  const e = env();
  let lastErr = null;

  /* textToImageAsync — основной эндпоинт; imageGenerationAsync — запасной
     (у Yandex имена периодически меняются). */
  for (const endpoint of ["textToImageAsync", "imageGenerationAsync"]) {
    try {
      const payload = {
        modelUri: `art://${e.folder}/${e.artModel}/latest`,
        prompt,
        mimeType: "JPEG",
        ratio: typeof ratio === "string" && /^\d+:\d+$/.test(ratio) ? ratio : "1:1",
      };
      if (seed !== undefined && seed !== null && Number.isFinite(Number(seed))) payload.seed = Number(seed);

      const startRes = await fetch(`${BASE}/foundationModels/v1/${endpoint}`, {
        method: "POST",
        headers: yandexHeaders(),
        body: JSON.stringify(payload),
      });
      const sb = await startRes.text();
      if (!startRes.ok) throw new Error(extractYandexError(startRes.status, sb));

      const start = JSON.parse(sb);
      const opId = start && start.id;
      if (!opId) throw new Error("YandexART не вернул id операции");

      const response = await pollOperation(opId, 180000);
      const b64 =
        (response && (response.imageBase64 || response.image)) ||
        (response && response.result && response.result.imageBase64) ||
        null;
      if (!b64) throw new Error("YandexART вернул операцию без imageBase64");

      return ok({ dataUrl: `image/jpeg;base64,${b64}`, mimeType: "image/jpeg", model: e.artModel });
    } catch (err) {
      lastErr = err;
      /* 404 — вероятно, другой эндпоинт: пробуем следующий. Остальное — наружу. */
      if (!/404|not found/i.test((err && err.message) || "")) break;
    }
  }

  return fail(502, lastErr && lastErr.message ? lastErr.message : "не удалось сгенерировать изображение");
};
