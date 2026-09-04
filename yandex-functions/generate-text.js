"use strict";
/* YandexGPT — генерация текста (истории). Точка входа: generate-text.handler
   Запрос : POST { prompt, system?, temperature?, maxTokens? }
   Ответ  : 200 { result, model, chars }
   Ключи  : YANDEX_API_KEY / YANDEX_FOLDER_ID из process.env. */
const {
  BASE, env, configured, yandexHeaders, parseBody,
  clamp, clampInt,
  isPreflight, preflightResponse, ok, fail, extractYandexError, fetch,
} = require("./lib");

exports.handler = async (event) => {
  if (isPreflight(event)) return preflightResponse();
  if (!configured())
    return fail(503, "Yandex не настроен: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID в переменных окружения функции");

  const { prompt, system, temperature, maxTokens } = parseBody(event);
  if (typeof prompt !== "string" || !prompt.trim()) return fail(400, "prompt обязателен и должен быть непустой строкой");
  if (prompt.length > 20000) return fail(400, "prompt длиннее 20000 символов");

  const e = env();
  const messages = [];
  if (typeof system === "string" && system.trim()) messages.push({ role: "system", text: system });
  messages.push({ role: "user", text: prompt });

  try {
    const res = await fetch(`${BASE}/foundationModels/v1/completion`, {
      method: "POST",
      headers: yandexHeaders(),
      body: JSON.stringify({
        modelUri: `gpt://${e.folder}/${e.textModel}`,
        completionOptions: {
          stream: false,
          temperature: clamp(temperature, 0, 1, 0.85),
          maxTokens: String(clampInt(maxTokens, 1, 8000, 8000)),
        },
        messages,
      }),
    });
    const body = await res.text();
    if (!res.ok) return fail(res.status === 429 ? 429 : 502, extractYandexError(res.status, body));

    const j = JSON.parse(body);
    const alt = j && j.result && j.result.alternatives && j.result.alternatives[0];
    const text = (alt && alt.message && alt.message.text) || "";
    if (!text) return fail(502, "YandexGPT вернул пустой текст");

    return ok({ result: text, model: e.textModel, chars: text.length });
  } catch (err) {
    return fail(500, err && err.message ? err.message : "внутренняя ошибка генерации текста");
  }
};
