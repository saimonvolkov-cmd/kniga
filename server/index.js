/* ─────────────────────────────────────────────────────────────────────────
   Серверный прокси Yandex AI Studio (YandexGPT + YandexART).
   Нулевые зависимости — только Node.js ≥ 18:  node server/index.js

   Эндпоинты:
     GET  /api/health          — живой ли сервер, настроены ли провайдеры
     POST /api/generate-text   — YandexGPT → { text, model }
     POST /api/generate-image  — YandexART → { dataUrl, mimeType }
     POST /api/generate        — комбо: GPT расширяет промпт → ART рисует

   Ключи читаются ТОЛЬКО из окружения / .env (корень проекта или server/).
   В браузер ключ никогда не уходит; сам ключ никогда не логируется.
   Также раздаёт статику из dist/ (сначала выполните `npm run build`),
   чтобы фронтенд и API жили на одном origin.
   ───────────────────────────────────────────────────────────────────────── */

import http from "node:http";
import { readFileSync, existsSync, createReadStream, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

/* ── .env (реальные переменные окружения имеют приоритет) ────────────────── */
function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined || process.env[m[1]] === "") process.env[m[1]] = v;
  }
  return true;
}
loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(__dirname, ".env"));

const CONFIG = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 8787),
  yandexKey: (process.env.YANDEX_API_KEY || "").trim(),
  yandexFolder: (process.env.YANDEX_FOLDER_ID || "").trim(),
  base: process.env.YANDEX_BASE_URL || "https://ai.api.cloud.yandex.net",
  textModel: process.env.YANDEX_TEXT_MODEL || "yandexgpt-lite",
  artModel: process.env.YANDEX_ART_MODEL || "yandex-art",
  corsOrigin: process.env.CORS_ORIGIN || "", // доп. origin через запятую; localhost разрешён всегда
  limits: {
    // запросов в минуту на один IP
    text: Number(process.env.RATE_TEXT || 30),
    image: Number(process.env.RATE_IMAGE || 12),
    generate: Number(process.env.RATE_GENERATE || 8),
    global: Number(process.env.RATE_GLOBAL || 90),
  },
};

const hasYandex = Boolean(CONFIG.yandexKey && CONFIG.yandexFolder);

/* ── утилиты ─────────────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Вычищаем всё, что похоже на секрет, из текстов, идущих в логи/ответы */
function redact(s) {
  return String(s).replace(
    /(Api-Key\s+|Bearer\s+|["']?(?:api[_-]?key|apikey|token|authorization)["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-.]{10,}/gi,
    "$1[REDACTED]"
  );
}

class ApiError extends Error {
  constructor(status, message, transient = false) {
    super(message);
    this.status = status;
    this.transient = transient;
  }
}

function log(req, status, startedAt, extra = "") {
  const ms = Date.now() - startedAt;
  const ip = req.socket?.remoteAddress ?? "?";
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} → ${status} · ${ms}ms · ${ip}${extra ? " · " + extra : ""}`);
}

/* ── CORS: свой бэкенд вправе разрешать браузеру (в отличие от Yandex API) ── */
function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const extra = CONFIG.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin && (isLocalhost || extra.includes("*") || extra.includes(origin))) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "Origin",
    };
  }
  return {};
}

/* ── rate limiting: скользящее окно 60 с, per-IP ─────────────────────────── */
const hits = new Map(); // ip -> { bucketName -> [timestamps] }
setInterval(() => {
  const now = Date.now();
  for (const [ip, buckets] of hits) {
    for (const b of Object.keys(buckets)) buckets[b] = buckets[b].filter((t) => now - t < 60_000);
    if (Object.values(buckets).every((a) => a.length === 0)) hits.delete(ip);
  }
}, 60_000).unref();

function rateLimited(ip, bucket, limit) {
  const buckets = hits.get(ip) ?? hits.set(ip, {}).get(ip);
  const arr = (buckets[bucket] ??= []);
  const now = Date.now();
  while (arr.length && now - arr[0] > 60_000) arr.shift();
  if (arr.length >= limit) return Math.max(1, Math.ceil((60_000 - (now - arr[0])) / 1000));
  arr.push(now);
  return 0;
}

/* ── тело запроса + валидация ────────────────────────────────────────────── */
function readBody(req, maxBytes = 200 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new ApiError(400, `тело запроса больше ${Math.round(maxBytes / 1024)} КБ`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => reject(new ApiError(400, "не удалось прочитать тело запроса")));
  });
}

function needString(v, name, min = 1, max = 6000) {
  if (typeof v !== "string" || v.trim().length < min)
    throw new ApiError(400, `поле "${name}" обязательно (строка, минимум ${min} символов)`);
  const s = v.trim();
  if (s.length > max) throw new ApiError(400, `поле "${name}" длиннее ${max} символов`);
  return s;
}

function needNum(v, name, min, max, def) {
  if (v === undefined || v === null) return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ApiError(400, `поле "${name}" должно быть числом от ${min} до ${max}`);
  return n;
}

/* ── клиент Yandex Cloud ─────────────────────────────────────────────────── */
function yandexHeaders() {
  return {
    "content-type": "application/json",
    authorization: `Api-Key ${CONFIG.yandexKey}`,
    "x-folder-id": CONFIG.yandexFolder,
  };
}

async function yandexFetch(url, opts = {}, timeoutMs = 60_000) {
  let res;
  try {
    res = await fetch(url, { ...opts, headers: yandexHeaders(), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError")
      throw new ApiError(504, "таймаут ожидания Yandex API", true);
    throw new ApiError(502, `сеть до Yandex API недоступна: ${e?.message ?? e}`, true);
  }
  const body = await res.text();
  return { res, body };
}

function upstreamError(status, body, what) {
  let msg = body;
  try {
    msg = JSON.parse(body)?.error?.message ?? body;
  } catch { /* не JSON — оставляем как есть */ }
  const transient = status === 429 || status >= 500;
  return new ApiError(transient ? (status === 429 ? 429 : 502) : 502, `${what}: HTTP ${status} — ${redact(msg).slice(0, 600)}`, transient);
}

function ensureYandex() {
  if (!hasYandex)
    throw new ApiError(503, "Yandex Cloud не настроен на сервере: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID в .env");
}

/** Поллинг операции Foundation Models до done (или error/таймаут) */
async function pollOperation(opId, what, totalMs = 150_000) {
  const deadline = Date.now() + totalMs;
  let pause = 700;
  while (Date.now() < deadline) {
    const { res, body } = await yandexFetch(`${CONFIG.base}/operations/${opId}`, {}, 15_000);
    if (!res.ok) throw upstreamError(res.status, body, `${what}: поллинг операции`);
    const op = JSON.parse(body);
    if (op.error) throw new ApiError(502, `${what}: операция завершилась с ошибкой — ${op.error.message ?? "без описания"}`);
    if (op.done) return op;
    await sleep(pause);
    pause = Math.min(2500, pause + 300);
  }
  throw new ApiError(504, `${what}: операция ${opId} не завершилась за ${Math.round(totalMs / 1000)} с`, true);
}

/** 1 повтор на временные ошибки (сеть, 5xx, 429) */
async function withRetry(fn, what) {
  try {
    return await fn();
  } catch (e) {
    if (!e?.transient) throw e;
    await sleep(900);
    try {
      return await fn();
    } catch (e2) {
      if (e2 instanceof ApiError) throw e2;
      throw new ApiError(502, `${what}: ${redact(e2?.message ?? e2)}`);
    }
  }
}

/* ── YandexGPT (текст) ─────────────────────────────────────────────────────
   Основной путь — синхронный OpenAI-совместимый REST POST /v1/responses
   (модель gpt://<folder>/yandexgpt-lite). Если маршрут недоступен (404/501) —
   проверенный асинхронный completionAsync + поллинг операции. */
async function yandexText({ prompt, system, temperature, maxTokens }) {
  const modelUri = `gpt://${CONFIG.yandexFolder}/${CONFIG.textModel}`;
  const combined = system ? `${system}\n\n${prompt}` : prompt;

  const viaResponses = async () => {
    const { res, body } = await yandexFetch(
      `${CONFIG.base}/v1/responses`,
      {
        method: "POST",
        body: JSON.stringify({ model: modelUri, input: combined, temperature, max_output_tokens: maxTokens }),
      },
      90_000
    );
    if (!res.ok) throw upstreamError(res.status, body, "YandexGPT (responses)");
    const j = JSON.parse(body);
    const text =
      j?.output_text ??
      (Array.isArray(j?.output) ? j.output.flatMap((o) => o?.content ?? []).find((c) => c?.text)?.text : null);
    if (!text) throw new ApiError(502, "YandexGPT (responses): ответ без текста");
    return text;
  };

  const viaCompletionAsync = async () => {
    const { res, body } = await yandexFetch(
      `${CONFIG.base}/foundationModels/v1/completionAsync`,
      {
        method: "POST",
        body: JSON.stringify({
          modelUri,
          completionOptions: { stream: false, temperature, maxTokens: String(maxTokens) },
          messages: [{ role: "user", text: combined }],
        }),
      },
      30_000
    );
    if (!res.ok) throw upstreamError(res.status, body, "YandexGPT (completionAsync)");
    const id = JSON.parse(body)?.id;
    if (!id) throw new ApiError(502, "YandexGPT: ответ без id операции");
    const op = await pollOperation(id, "YandexGPT");
    const text = op?.response?.alternatives?.[0]?.message?.text;
    if (!text) throw new ApiError(502, "YandexGPT: операция без текста");
    return text;
  };

  try {
    return { text: await viaResponses(), route: "responses" };
  } catch (e) {
    const st = e?.status;
    if (st === 404 || st === 400 || st === 501) return { text: await viaCompletionAsync(), route: "completionAsync" };
    throw e;
  }
}

/* ── YandexART (изображение, асинхронная операция) ───────────────────────── */
async function yandexImage({ prompt, seed, widthRatio, heightRatio }) {
  let lastErr = null;
  for (const endpoint of ["textToImageAsync", "imageGenerationAsync"]) {
    try {
      const payload = {
        modelUri: `art://${CONFIG.yandexFolder}/${CONFIG.artModel}/latest`,
        prompt,
        ratio: `${widthRatio}:${heightRatio}`,
        mimeType: "image/jpeg",
      };
      if (seed !== undefined) payload.seed = seed;
      const { res, body } = await yandexFetch(
        `${CONFIG.base}/foundationModels/v1/${endpoint}`,
        { method: "POST", body: JSON.stringify(payload) },
        30_000
      );
      if (!res.ok) throw upstreamError(res.status, body, `YandexART (${endpoint})`);
      const id = JSON.parse(body)?.id;
      if (!id) throw new ApiError(502, "YandexART: ответ без id операции");
      const op = await pollOperation(id, "YandexART", 180_000);
      const b64 = op?.response?.imageBase64 ?? op?.response?.image;
      if (!b64) throw new ApiError(502, "YandexART: операция завершилась без imageBase64");
      return `data:image/jpeg;base64,${b64}`;
    } catch (e) {
      lastErr = e;
      // второй эндпоинт пробуем только если первый «не найден», остальное — наружу
      if (!(e instanceof ApiError && e.status === 404)) break;
    }
  }
  throw lastErr;
}

/* ── раздаёт dist/ + SPA-fallback ────────────────────────────────────────── */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon",
  ".json": "application/json", ".map": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
};

function serveStatic(req, res, urlPath) {
  if (!existsSync(DIST)) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    res.end("dist/ не найден — выполните `npm run build`, либо обращайтесь к /api/* напрямую");
    return;
  }
  let file = path.normalize(path.join(DIST, urlPath));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end("forbidden"); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, "index.html"); // SPA fallback
  res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

/* ── маршруты API ────────────────────────────────────────────────────────── */
async function handleApi(req, res, url, ip, cors) {
  const startedAt = Date.now();
  const send = (status, obj, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...cors, ...headers });
    res.end(JSON.stringify(obj));
    log(req, status, startedAt, obj?.error ? redact(String(obj.error)).slice(0, 160) : "");
  };

  try {
    /* лимиты: общий + по корзинам */
    const waitGlobal = rateLimited(ip, "global", CONFIG.limits.global);
    if (waitGlobal) return send(429, { error: "слишком много запросов с вашего IP" }, { "retry-after": String(waitGlobal) });
    const bucket = url === "/api/generate-text" ? "text" : url === "/api/generate-image" ? "image" : url === "/api/generate" ? "generate" : null;
    if (bucket) {
      const wait = rateLimited(ip, bucket, CONFIG.limits[bucket]);
      if (wait) return send(429, { error: `лимит на ${url} исчерпан, повторите позже` }, { "retry-after": String(wait) });
    }

    if (url === "/api/health" && req.method === "GET") {
      return send(200, {
        ok: true,
        providers: { yandexText: hasYandex, yandexImage: hasYandex },
        textModel: CONFIG.textModel,
        artModel: CONFIG.artModel,
      });
    }

    if (req.method !== "POST") return send(405, { error: "только POST" });
    ensureYandex();

    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      return send(400, { error: "тело запроса — некорректный JSON" });
    }

    if (url === "/api/generate-text") {
      const prompt = needString(payload.prompt, "prompt", 1, 6000);
      const system = payload.system === undefined ? "" : needString(payload.system, "system", 1, 4000);
      const temperature = needNum(payload.temperature, "temperature", 0, 1, 0.8);
      const maxTokens = Math.round(needNum(payload.maxTokens, "maxTokens", 64, 12000, 4000));
      const { text, route } = await withRetry(() => yandexText({ prompt, system, temperature, maxTokens }), "YandexGPT");
      return send(200, { text, model: CONFIG.textModel, route, chars: text.length });
    }

    if (url === "/api/generate-image") {
      const prompt = needString(payload.prompt, "prompt", 1, 4000);
      const seed = payload.seed === undefined || payload.seed === null
        ? undefined
        : Math.round(needNum(payload.seed, "seed", 0, 2 ** 31 - 1, 0));
      const widthRatio = Math.round(needNum(payload.widthRatio, "widthRatio", 1, 4, 1));
      const heightRatio = Math.round(needNum(payload.heightRatio, "heightRatio", 1, 4, 1));
      const dataUrl = await withRetry(() => yandexImage({ prompt, seed, widthRatio, heightRatio }), "YandexART");
      return send(200, { dataUrl, mimeType: "image/jpeg" });
    }

    if (url === "/api/generate") {
      const brief = needString(payload.brief ?? payload.prompt, "brief", 1, 2000);
      const { text: expanded } = await withRetry(
        () =>
          yandexText({
            prompt: brief,
            system:
              "Ты — иллюстратор детской книги. По короткой сцене напиши ОДИН подробный промпт для генерации картинки на английском, до 70 слов: " +
              "hand-drawn storybook watercolor style, muted earthy palette, персонаж смотрит на действие (не в камеру), фон заполнен деталями. Без пояснений, только промпт.",
            temperature: 0.9,
            maxTokens: 250,
          }),
        "YandexGPT (расширение промпта)"
      );
      const prompt = expanded.trim().replace(/^["']|["']$/g, "");
      const dataUrl = await withRetry(
        () => yandexImage({ prompt, seed: undefined, widthRatio: 1, heightRatio: 1 }),
        "YandexART"
      );
      return send(200, { prompt, dataUrl, mimeType: "image/jpeg" });
    }

    return send(404, { error: `нет такого эндпоинта: ${url}` });
  } catch (e) {
    if (e instanceof ApiError) {
      const headers = e.status === 429 ? { "retry-after": "60" } : {};
      return send(e.status, { error: e.message }, headers);
    }
    console.error("необработанная ошибка:", redact(e?.stack ?? String(e)));
    return send(500, { error: "внутренняя ошибка сервера" });
  }
}

/* ── сервер ──────────────────────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  const cors = corsHeaders(req);
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (url.startsWith("/api/")) {
    handleApi(req, res, url, ip, cors).catch((e) => {
      console.error("сбой в handleApi:", redact(String(e?.stack ?? e)));
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "внутренняя ошибка сервера" }));
      }
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`\n  Сказка про меня · серверный прокси Yandex AI Studio`);
  console.log(`  → http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`  → Yandex Cloud: ${hasYandex ? "настроен (ключ загружен из окружения, в логах не показывается)" : "НЕ НАСТРОЕН — создайте .env с YANDEX_API_KEY и YANDEX_FOLDER_ID"}`);
  console.log(`  → модели: текст ${CONFIG.textModel} · картинки ${CONFIG.artModel}`);
  console.log(`  → статика: ${existsSync(DIST) ? "dist/ раздаётся" : "dist/ не найден (npm run build)"}\n`);
});

process.on("SIGINT", () => {
  console.log("\nостанавливаю сервер…");
  server.close(() => process.exit(0));
});
