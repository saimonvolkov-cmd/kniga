"use strict";
/* Общие хелперы для всех Cloud Functions. Входит в каждый ZIP-архив.
   Ключи читаются ТОЛЬКО из process.env (задаются в консоли Yandex Cloud
   при создании версии функции) и никогда не логируются. */
const fetch = require("node-fetch");

const BASE = "https://ai.api.cloud.yandex.net";

function env() {
  return {
    key: (process.env.YANDEX_API_KEY || "").trim(),
    folder: (process.env.YANDEX_FOLDER_ID || "").trim(),
    textModel: process.env.YANDEX_TEXT_MODEL || "yandexgpt",
    artModel: process.env.YANDEX_ART_MODEL || "yandex-art",
  };
}

function configured() {
  const e = env();
  return Boolean(e.key && e.folder);
}

function yandexHeaders() {
  const e = env();
  return {
    "content-type": "application/json",
    authorization: `Api-Key ${e.key}`,
    "x-folder-id": e.folder,
  };
}

/* секрет не должен просочиться в ответы/логи */
const redact = (s = "") => String(s).replace(/(t1\.|AQVN)[\w-]{8,}/gi, "****");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clamp(v, lo, hi, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

/* Тело HTTP-запроса от триггера: строка (иногда base64) → объект */
function parseBody(event) {
  try {
    let raw = event && event.body ? event.body : "";
    if (event && event.isBase64Encoded && raw) raw = Buffer.from(raw, "base64").toString("utf8");
    if (!raw) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

/* CORS: фронтенд вызывает функции с другого origin, ключи при этом остаются
   на сервере — из браузера в Yandex по-прежнему нет ни одного запроса. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function isPreflight(event) {
  return Boolean(event && String(event.httpMethod || "").toUpperCase() === "OPTIONS");
}
function preflightResponse() {
  return { statusCode: 200, headers: CORS, body: "" };
}

function ok(body) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", ...CORS },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

function fail(status, message) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...CORS },
    body: JSON.stringify({ error: redact(String(message)).slice(0, 600) }),
  };
}

function extractYandexError(status, body) {
  let msg = body;
  try {
    const j = JSON.parse(body);
    msg = j && j.error && j.error.message ? j.error.message : body;
  } catch {
    /* тело не JSON — показываем как есть */
  }
  return `HTTP ${status}: ${msg}`;
}

/* Асинхронные операции Yandex: запрос вернул id → поллим GET /operations/{id}
   до done (или ошибки/таймаута). */
async function pollOperation(opId, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 180000);
  while (Date.now() < deadline) {
    await sleep(2000);
    const res = await fetch(`${BASE}/operations/${opId}`, { headers: yandexHeaders() });
    const body = await res.text();
    if (!res.ok) throw new Error(extractYandexError(res.status, body));
    const op = JSON.parse(body);
    if (op.error)
      throw new Error(`операция Yandex завершилась с ошибкой: ${op.error.message || JSON.stringify(op.error)}`);
    if (op.done) return op.response;
  }
  throw new Error(`операция ${opId} не завершилась за отведённое время`);
}

module.exports = {
  BASE, env, configured, yandexHeaders,
  parseBody, clamp, clampInt,
  CORS, isPreflight, preflightResponse, ok, fail,
  extractYandexError, pollOperation, sleep, fetch,
};
