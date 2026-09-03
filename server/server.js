/* ─────────────────────────────────────────────────────────────────────────
   Локальный прокси Yandex AI Studio (YandexGPT + YandexART) — Express.

   Зачем: Yandex AI Studio не отдаёт CORS-заголовки, поэтому браузер физически
   не может вызвать его напрямую. Этот сервер — посредник: фронтенд ходит на
   http://localhost:3001/api/yandex/*, а сервер уже с ключом из .env вызывает
   Yandex. Ключ НИКОГДА не попадает в браузер и не логируется.

   Запуск:   npm --prefix server run server      (или: node server/server.js)
   Порт:     3001 (или переменная PORT)
   Ключи:    ../.env или server/.env (YANDEX_API_KEY, YANDEX_FOLDER_ID),
             настоящие переменные окружения имеют приоритет.
   Проверка: npm --prefix server run smoke        (прямой дымовой тест ключа)
   ───────────────────────────────────────────────────────────────────────── */
import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/* ── .env (без лишних зависимостей) ─────────────────────────────────────── */
function loadEnv() {
  const env = { ...process.env };
  for (const p of [join(here, "..", ".env"), join(here, ".env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) env[m[1]] = env[m[1]] ?? m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const KEY = (env.YANDEX_API_KEY || "").trim();
const FOLDER = (env.YANDEX_FOLDER_ID || "").trim();
const PORT = Number(env.PORT || 3001);
const TEXT_MODEL = env.YANDEX_TEXT_MODEL || "yandexgpt";
const ART_MODEL = env.YANDEX_ART_MODEL || "yandex-art";
const configured = Boolean(KEY && FOLDER);

const BASE = "https://ai.api.cloud.yandex.net";
const yandexHeaders = configured
  ? { "content-type": "application/json", authorization: `Api-Key ${KEY}`, "x-folder-id": FOLDER }
  : null;

/* секрет не должен просочиться в логи и ответы */
const redact = (s = "") => String(s).replace(/(t1\.|AQVN)[\w-]{8,}/gi, "****");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/* ── приложение ─────────────────────────────────────────────────────────── */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "500kb" }));

/* CORS: фронтенд живёт на другом порту (vite 5173 / статика) — разрешаем
   локальные origins. Yandex при этом остаётся недоступен браузеру напрямую. */
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ── rate limiting (скользящее окно, на IP) ─────────────────────────────── */
const buckets = new Map();
function rateLimited(bucket, max, windowMs, ip) {
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (buckets.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(k, arr);
    return true;
  }
  arr.push(now);
  buckets.set(k, arr);
  return false;
}
const ipOf = (req) => req.ip || req.socket?.remoteAddress || "unknown";

/* ── ошибки Yandex → понятные HTTP-коды ─────────────────────────────────── */
function upstreamError(status, body) {
  let msg = body;
  try {
    msg = JSON.parse(body)?.error?.message ?? body;
  } catch {
    /* тело не JSON — оставляем как есть */
  }
  const e = new Error(redact(msg).slice(0, 600));
  e.status = /429|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 502;
  return e;
}
function sendErr(res, e) {
  const status = e?.status || 500;
  console.error(`[proxy] ${redact(e?.message || "error")}`);
  res.status(status).json({ error: e?.message || "внутренняя ошибка прокси" });
}

/* ── поллинг операции Foundation Models (перенесён с фронтенда) ─────────── */
async function poll(opId) {
  for (let i = 0; i < 90; i++) {
    // до ~180 с
    await sleep(2000);
    const res = await fetch(`${BASE}/operations/${opId}`, { headers: yandexHeaders });
    const body = await res.text();
    if (!res.ok) throw upstreamError(res.status, body);
    const op = JSON.parse(body);
    if (op.error) {
      const e = new Error(redact(op.error.message ?? JSON.stringify(op.error)).slice(0, 600));
      e.status = 502;
      throw e;
    }
    if (op.done) return op.response;
  }
  const e = new Error("операция Yandex не завершилась за отведённое время");
  e.status = 504;
  throw e;
}

const requireConfigured = (res) => {
  if (!configured) {
    res.status(503).json({
      error: "Yandex не настроен на сервере: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID в .env и перезапустите прокси",
    });
    return false;
  }
  return true;
};

/* ── GET /api/yandex/status — заданы ли ключи (без реального вызова API) ── */
app.get("/api/yandex/status", (_req, res) => {
  res.json({
    ok: true,
    configured,
    providers: { yandexText: configured, yandexImage: configured },
    model: { text: TEXT_MODEL, art: ART_MODEL },
  });
});

/* ── POST /api/yandex/generate-text — YandexGPT (completionAsync + поллинг) */
app.post("/api/yandex/generate-text", async (req, res) => {
  if (!requireConfigured(res)) return;
  if (rateLimited("text", 30, 60_000, ipOf(req)))
    return res.status(429).json({ error: "слишком много запросов текста (лимит 30/мин)" });

  const { prompt, system, temperature, maxTokens } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim())
    return res.status(400).json({ error: "prompt обязателен и должен быть непустой строкой" });
  if (prompt.length > 20_000) return res.status(400).json({ error: "prompt длиннее 20000 символов" });

  const messages = [];
  if (typeof system === "string" && system.trim()) messages.push({ role: "system", text: system });
  messages.push({ role: "user", text: prompt });

  try {
    const startRes = await fetch(`${BASE}/foundationModels/v1/completionAsync`, {
      method: "POST",
      headers: yandexHeaders,
      body: JSON.stringify({
        modelUri: `gpt://${FOLDER}/${TEXT_MODEL}`,
        completionOptions: {
          stream: false,
          temperature: clamp(temperature, 0, 1, 0.8),
          maxTokens: String(clamp(maxTokens, 1, 8000, 8000)),
        },
        messages,
      }),
    });
    const sb = await startRes.text();
    if (!startRes.ok) throw upstreamError(startRes.status, sb);
    const opId = JSON.parse(sb)?.id;
    if (!opId) throw Object.assign(new Error("YandexGPT не вернул id операции"), { status: 502 });

    const resp = await poll(opId);
    const text =
      resp?.result?.alternatives?.[0]?.message?.text ?? resp?.alternatives?.[0]?.message?.text ?? "";
    if (!text) throw Object.assign(new Error("YandexGPT вернул пустой текст"), { status: 502 });

    res.json({ text, model: TEXT_MODEL, chars: text.length });
  } catch (e) {
    sendErr(res, e);
  }
});

/* ── POST /api/yandex/generate-image — YandexART (async + поллинг → base64) */
app.post("/api/yandex/generate-image", async (req, res) => {
  if (!requireConfigured(res)) return;
  if (rateLimited("image", 12, 60_000, ipOf(req)))
    return res.status(429).json({ error: "слишком много запросов картинок (лимит 12/мин)" });

  const { prompt, seed, ratio } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim())
    return res.status(400).json({ error: "prompt обязателен и должен быть непустой строкой" });
  if (prompt.length > 4000) return res.status(400).json({ error: "prompt длиннее 4000 символов" });

  let lastErr = null;
  for (const endpoint of ["textToImageAsync", "imageGenerationAsync"]) {
    try {
      const startRes = await fetch(`${BASE}/foundationModels/v1/${endpoint}`, {
        method: "POST",
        headers: yandexHeaders,
        body: JSON.stringify({
          modelUri: `art://${FOLDER}/${ART_MODEL}/latest`,
          prompt,
          mimeType: "JPEG",
          ratio: typeof ratio === "string" && /^\d+:\d+$/.test(ratio) ? ratio : "1:1",
          ...(seed != null && Number.isFinite(Number(seed)) ? { seed: Number(seed) } : {}),
        }),
      });
      const sb = await startRes.text();
      if (!startRes.ok) throw upstreamError(startRes.status, sb);
      const opId = JSON.parse(sb)?.id;
      if (!opId) throw Object.assign(new Error("YandexART не вернул id операции"), { status: 502 });

      const resp = await poll(opId);
      const b64 = resp?.imageBase64 ?? resp?.image ?? resp?.result?.imageBase64;
      if (!b64) throw Object.assign(new Error("YandexART вернул операцию без imageBase64"), { status: 502 });

      return res.json({ dataUrl: `data:image/jpeg;base64,${b64}`, mimeType: "image/jpeg", model: ART_MODEL });
    } catch (e) {
      lastErr = e;
      if (!/404|not found/i.test(e.message)) break; // не тот эндпоинт — пробуем следующий
    }
  }
  sendErr(res, lastErr);
});

/* ── служебное ──────────────────────────────────────────────────────────── */
app.get("/", (_req, res) => {
  res.json({
    name: "skazka-yandex-proxy",
    configured,
    endpoints: ["GET /api/yandex/status", "POST /api/yandex/generate-text", "POST /api/yandex/generate-image"],
  });
});
app.use("/api", (_req, res) => res.status(404).json({ error: "нет такого эндпоинта" }));

app.listen(PORT, () => {
  console.log(`\n  Yandex-прокси запущен:  http://localhost:${PORT}`);
  console.log(`  Yandex ${configured ? "настроен на сервере ✓" : "НЕ настроен — заполните .env (YANDEX_API_KEY, YANDEX_FOLDER_ID)"}\n`);
});
