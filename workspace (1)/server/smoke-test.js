#!/usr/bin/env node
/* Дымовой тест Yandex AI Studio — прямые вызовы из Node (без CORS).
   Запуск:  node server/smoke-test.js
   Ключи:   из ../.env или server/.env, либо из переменных окружения. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const redact = (s = "") => s.replace(/(t1\.|AQVN)[\w-]{8,}/gi, "****");

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
if (!KEY || !FOLDER) {
  console.error("✗ В .env нет YANDEX_API_KEY и/или YANDEX_FOLDER_ID");
  process.exit(1);
}

const BASE = "https://ai.api.cloud.yandex.net";
const headers = { "content-type": "application/json", authorization: `Api-Key ${KEY}`, "x-folder-id": FOLDER };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, what) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`↻ повтор (${what}): ${redact(e.message)}`);
    await sleep(900);
    return await fn();
  }
}

async function poll(opId, what) {
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const res = await fetch(`${BASE}/operations/${opId}`, { headers });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`);
    const op = JSON.parse(body);
    if (op.error) throw new Error(`ошибка операции: ${op.error.message ?? JSON.stringify(op.error).slice(0, 300)}`);
    if (op.done) return op.response;
    process.stdout.write(".");
  }
  throw new Error(`${what}: операция не завершилась за 180 с`);
}

console.log("1) YandexGPT · синхронный completion…");
const t0 = Date.now();
const textBody = await withRetry(async () => {
  const res = await fetch(`${BASE}/foundationModels/v1/completion`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modelUri: `gpt://${FOLDER}/yandexgpt-lite`,
      completionOptions: { stream: false, temperature: 0.6, maxTokens: "120" },
      messages: [{ role: "user", text: "Скажи «дымовой тест пройден» и добавь одно предложение о себе." }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`);
  return body;
}, "YandexGPT");
const text = JSON.parse(textBody)?.result?.alternatives?.[0]?.message?.text ?? "";
if (!text) {
  console.error("✗ YandexGPT вернул пустой текст:", textBody.slice(0, 300));
  process.exit(1);
}
console.log(`✓ YandexGPT ответил за ${((Date.now() - t0) / 1000).toFixed(1)} с: ${text.slice(0, 160)}`);

console.log("\n2) YandexART · textToImageAsync · ratio 1:1…");
const t1 = Date.now();
let opId = null;
for (const endpoint of ["textToImageAsync", "imageGenerationAsync"]) {
  try {
    const body = await withRetry(async () => {
      const res = await fetch(`${BASE}/foundationModels/v1/${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          modelUri: `art://${FOLDER}/yandex-art/latest`,
          prompt: "a red cat, Miyazaki style, children's book watercolor illustration, warm light",
          mimeType: "JPEG",
          ratio: "1:1",
          seed: 42,
        }),
      });
      const b = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${b.slice(0, 400)}`);
      return b;
    }, `YandexART ${endpoint}`);
    opId = JSON.parse(body)?.id;
    if (opId) {
      console.log(`   эндпоинт ${endpoint} · операция ${opId}`);
      break;
    }
  } catch (e) {
    console.warn(`   ${endpoint}: ${redact(e.message)}`);
  }
}
if (!opId) {
  console.error("✗ не удалось запустить генерацию изображения");
  process.exit(1);
}
process.stdout.write("   поллинг операции ");
const response = await poll(opId, "YandexART");
console.log("");
const b64 = response?.imageBase64 ?? response?.image;
if (!b64) {
  console.error("✗ операция завершилась без imageBase64:", JSON.stringify(response).slice(0, 300));
  process.exit(1);
}
const out = join(here, "test-image.jpg");
writeFileSync(out, Buffer.from(b64, "base64"));
console.log(`✓ YandexART нарисовал картинку за ${((Date.now() - t1) / 1000).toFixed(1)} с → ${out} (${Math.round((b64.length * 0.75) / 1024)} КБ)`);

console.log("\nУСПЕХ: ключ и роли работают.");
console.log("Дальше:  npm --prefix server run server   → прокси на http://localhost:3001");
