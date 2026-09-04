import type { ApiKeys, BookInput, EngineKind, StoryJSON, StoryProvider } from "../types";
import { generateStory as demoGenerateStory, validateStory } from "./storyEngine";
import { delay } from "./utils";

/* ── Хранилище ключей (localStorage, только для Gemini/Claude/HF) ──────────
   Yandex-ключи в браузере больше не нужны: они живут в серверном .env, а
   запросы идут через локальный прокси /api/yandex/* (Yandex не отдаёт CORS). */
const KEYS_STORAGE = "skazka.apikeys.v1";
const EMPTY_KEYS: ApiKeys = { gemini: "", anthropic: "", huggingface: "", yandexApiKey: "", yandexFolderId: "" };

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (raw) return { ...EMPTY_KEYS, ...(JSON.parse(raw) as Partial<ApiKeys>) };
  } catch { /* noop */ }
  return { ...EMPTY_KEYS };
}

export function saveKeys(keys: ApiKeys): void {
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch { /* noop */ }
}

/* ── Narrative Module: текстовые провайдеры ─────────────────────────────── */
export interface StoryResult {
  story: StoryJSON;
  engine: EngineKind;
}

const STORY_SYSTEM =
  "Ты — детский писатель. Пишешь тёплые сказки на русском для детей 2–9 лет. " +
  "Никакой жестокости, насилия и пугающих образов. Каждое предложение короткое и ритмичное.";

function buildStoryPrompt(input: BookInput, seed: number): string {
  return (
    `Сгенерируй персональную детскую книгу строго в формате JSON (без markdown-ограждений) по схеме:\n` +
    `{"title":string,"word_limit_per_spread":30,"cover":{"scene_description":string,"title_text":string},` +
    `"back_cover":{"scene_description":string,"blurb_text":string},` +
    `"hero_journey_map":{"ordinary_world":[1,2],"call_to_adventure":[3,4],"trial":[5,...],"climax":[N-3,N-2],"return_lesson":[N-1,N]},` +
    `"spreads":[{"spread_number":1,"stage":"ordinary_world","text":"до 30 слов","scene_description":"кто, что делает, где — технически, без метафор",` +
    `"characters_present":["child","companion"],"gaze_direction":"куда смотрит персонаж (никогда не в камеру)","emotion":string}]}\n\n` +
    `INPUT JSON:\n${JSON.stringify(input, null, 2)}\n\n` +
    `Требования: ровно ${input.spread_count} разворотов (spread_number 1..${input.spread_count}); ` +
    `текст каждого разворота ≤ 30 слов, для возраста 2–3 года ≤ 14 слов; ` +
    `имя ребёнка — в именительном падеже; gaze_direction всегда на объект действия; ` +
    `случайность-зерно ${seed}. Верни только JSON.`
  );
}

async function storyFromClaude(key: string, input: BookInput, seed: number): Promise<StoryJSON> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 12000,
      system: STORY_SYSTEM,
      messages: [{ role: "user", content: buildStoryPrompt(input, seed) }],
    }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}`);
  const j = await res.json();
  const raw: string = j?.content?.[0]?.text ?? "";
  const story = JSON.parse(raw.replace(/```json|```/g, "").trim()) as StoryJSON;
  if (!validateStory(story, input.spread_count)) throw new Error("invalid story json from claude");
  return story;
}

async function storyFromGemini(key: string, input: BookInput, seed: number): Promise<StoryJSON> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: STORY_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: buildStoryPrompt(input, seed) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
      }),
    }
  );
  const body = await res.text();
  if (!res.ok) {
    let msg = body;
    try { msg = (JSON.parse(body) as { error?: { message?: string } })?.error?.message ?? body; } catch { /* как есть */ }
    throw new Error(`gemini ${res.status}: ${msg}`);
  }
  const j = JSON.parse(body) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = (j?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const story = JSON.parse(raw.replace(/```json|```/g, "").trim()) as StoryJSON;
  if (!validateStory(story, input.spread_count)) throw new Error("invalid story json from gemini");
  return story;
}

/** Narrative Module: приоритет Claude → Gemini (запасной) → демо-движок.
    Если запущен локальный прокси — история идёт через него (YandexGPT).
    `provider` позволяет форсировать провайдера. */
export async function generateStoryViaApi(
  input: BookInput,
  keys: ApiKeys | null,
  seed: number,
  provider?: StoryProvider
): Promise<StoryResult> {
  if (!provider || provider === "yandex-gpt") {
    try {
      if (await isBackendAvailable()) {
        console.info("[narrative] история через прокси /api/yandex/generate-text (YandexGPT, ключ на сервере)");
        const raw = await backendGenerateText(buildStoryPrompt(input, seed), STORY_SYSTEM);
        const story = JSON.parse(raw.replace(/```json|```/g, "").trim()) as StoryJSON;
        if (validateStory(story, input.spread_count)) return { story, engine: "yandex-gpt" };
        throw new Error("invalid story json from backend");
      }
    } catch (e) {
      console.warn("[narrative] Yandex-прокси не справился, пробуем прямую цепочку:", e);
    }
  }
  if (keys?.anthropic) {
    try {
      return { story: await storyFromClaude(keys.anthropic, input, seed), engine: "gemini+claude" };
    } catch (e) {
      console.warn("[narrative] Claude недоступен:", e);
      if (keys?.gemini) console.info("[narrative] авто-фолбэк: история через Gemini");
    }
  }
  if (keys?.gemini) {
    try {
      return { story: await storyFromGemini(keys.gemini, input, seed), engine: "gemini" };
    } catch (e) {
      console.warn("[narrative] Gemini недоступен, фолбэк на демо-движок:", e);
    }
  }
  return { story: demoGenerateStory(input, seed), engine: "demo" };
}

/* ── Yandex-бэкенд: Cloud Functions (приоритет) или локальный прокси ──────
   Все адреса — в ОДНОЙ точке конфигурации (переменные сборки VITE_*, ничего не
   захардкожено под конкретный деплой):
     • Yandex Cloud Functions (yandex-functions/):
         VITE_YANDEX_TEXT_FN_URL / VITE_YANDEX_IMAGE_FN_URL / VITE_YANDEX_HEALTH_FN_URL
     • Локальный Express-прокси (server/):
         VITE_YANDEX_PROXY_URL, по умолчанию http://localhost:3001
   Cloud Functions проверяются первыми (health-чек); если не заданы или не
   отвечают — пробуем локальный прокси. Ключи в обоих случаях остаются на
   сервере, из браузера в Yandex нет ни одного прямого запроса. */

const viteEnv = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {});

const FN_TEXT_URL = (viteEnv.VITE_YANDEX_TEXT_FN_URL ?? "").trim();
const FN_IMAGE_URL = (viteEnv.VITE_YANDEX_IMAGE_FN_URL ?? "").trim();
const FN_HEALTH_URL = (viteEnv.VITE_YANDEX_HEALTH_FN_URL ?? "").trim();
const fnConfigured = Boolean(FN_TEXT_URL && FN_IMAGE_URL && FN_HEALTH_URL);

const PROXY_BASES: string[] = Array.from(
  new Set([(viteEnv.VITE_YANDEX_PROXY_URL ?? "").trim(), "http://localhost:3001", "http://127.0.0.1:3001"].filter(Boolean))
);

export type BackendMode = "cloud-functions" | "local-proxy" | "none";

let backendModePromise: Promise<BackendMode> | null = null;

async function probeCloudHealth(): Promise<boolean> {
  try {
    const res = await fetch(FN_HEALTH_URL, { method: "GET", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function probeLocalProxy(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/yandex/status`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { ok?: boolean; configured?: boolean };
    return j.ok === true && j.configured === true;
  } catch {
    return false;
  }
}

/** Какой Yandex-бэкенд доступен. Кэш на время жизни страницы. */
export function getBackendMode(force = false): Promise<BackendMode> {
  if (backendModePromise && !force) return backendModePromise;
  backendModePromise = (async () => {
    if (fnConfigured && (await probeCloudHealth())) return "cloud-functions";
    for (const base of PROXY_BASES) if (await probeLocalProxy(base)) return "local-proxy";
    return "none";
  })();
  return backendModePromise;
}

export async function isBackendAvailable(force = false): Promise<boolean> {
  return (await getBackendMode(force)) !== "none";
}

/** Статус для индикатора: cloud = Cloud Functions · backend = локальный прокси · off */
export async function detectConnection(force = false): Promise<"cloud" | "backend" | "off"> {
  const mode = await getBackendMode(force);
  return mode === "cloud-functions" ? "cloud" : mode === "local-proxy" ? "backend" : "off";
}

async function findProxyBase(): Promise<string> {
  for (const base of PROXY_BASES) if (await probeLocalProxy(base)) return base;
  throw new Error("локальный прокси недоступен (npm --prefix server run server)");
}

async function postJson(url: string, payload: unknown, timeoutMs: number, what: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, what, body));
  return body;
}

/** Текст: Cloud Functions ({result}) или локальный прокси ({text}) → raw-текст */
export async function backendGenerateText(prompt: string, system: string, maxTokens = 8000): Promise<string> {
  const mode = await getBackendMode();
  if (mode === "none")
    throw new Error("Yandex не настроен: задайте VITE_YANDEX_*_FN_URL (Cloud Functions) или запустите прокси");
  const payload = { prompt, system, temperature: 0.85, maxTokens };
  if (mode === "cloud-functions") {
    const body = await postJson(FN_TEXT_URL, payload, 180_000, "Cloud Function generate-text");
    const j = JSON.parse(body) as { result?: string; text?: string };
    const text = j.result ?? j.text;
    if (!text) throw new Error("Cloud Function generate-text вернула пустой текст");
    return text;
  }
  const base = await findProxyBase();
  const body = await postJson(`${base}/api/yandex/generate-text`, payload, 180_000, "прокси /api/yandex/generate-text");
  const text = (JSON.parse(body) as { text?: string }).text;
  if (!text) throw new Error("прокси /api/yandex/generate-text вернул пустой текст");
  return text;
}

/** Картинка: Cloud Functions или локальный прокси → dataURL */
export async function backendGenerateImage(prompt: string, seed?: number): Promise<string> {
  const mode = await getBackendMode();
  if (mode === "none")
    throw new Error("Yandex не настроен: задайте VITE_YANDEX_*_FN_URL (Cloud Functions) или запустите прокси");
  if (mode === "cloud-functions") {
    const body = await postJson(FN_IMAGE_URL, { prompt, seed }, 240_000, "Cloud Function generate-image");
    const dataUrl = (JSON.parse(body) as { dataUrl?: string }).dataUrl;
    if (!dataUrl) throw new Error("Cloud Function generate-image вернула ответ без dataUrl");
    return ensureDataPrefix(dataUrl);
  }
  const base = await findProxyBase();
  const body = await postJson(`${base}/api/yandex/generate-image`, { prompt, seed }, 240_000, "прокси /api/yandex/generate-image");
  const dataUrl = (JSON.parse(body) as { dataUrl?: string }).dataUrl;
  if (!dataUrl) throw new Error("прокси /api/yandex/generate-image вернул ответ без dataUrl");
  return ensureDataPrefix(dataUrl);
}

/* ── Illustration Module: провайдеры картинок ──────────────────────────────
   Ошибки НИКОГДА не глотаем: возвращается читаемый текст.
   Порядок: YandexART (только через прокси, Yandex не отдаёт CORS) → Gemini
   → Hugging Face (fal-ai / классический) → Pollinations (без ключа) → null. */

export interface ImageCallResult {
  dataUrl: string | null;
  error: string | null;
  via?: "gemini" | "yandex-art" | "huggingface" | "pollinations";
}

const ensureDataPrefix = (d: string) => (d.startsWith("data:") ? d : `data:${d}`);
const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(b);
  });

export function extractError(status: number, what: string, body: string): string {
  let msg = body;
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string };
    msg = typeof j?.error === "string" ? j.error : j?.error?.message ?? body;
  } catch { /* тело не JSON — показываем как есть */ }
  msg = msg.slice(0, 700);
  const QUOTA_RE = /quota|429|RESOURCE_EXHAUSTED|limit:\s*0/i;
  if (QUOTA_RE.test(`${status} ${msg}`))
    msg += "\n→ У ключа нулевой бесплатный лимит генерации изображений (free_tier limit: 0). Решение: Google AI Studio → Settings → Plan & Billing → включить платный тариф (есть бесплатный порог), либо другой ключ.";
  return `HTTP ${status} · ${what}: ${msg}`;
}

/* ── Gemini (Nano Banana) ───────────────────────────────────────────────── */
let quotaBreaker = false;
export function resetQuotaBreaker(): void {
  quotaBreaker = false;
  hfProviderAuthDead = false;
}
export function isQuotaError(e: string | null | undefined): boolean {
  return /quota|limit:\s*0|free_tier/i.test(e ?? "");
}

export async function generateImageViaApi(
  prompt: string,
  referencePhotos: string[],
  keys: ApiKeys | null
): Promise<ImageCallResult> {
  if (!keys?.gemini) return { dataUrl: null, error: "GEMINI_API_KEY не задан" };
  if (quotaBreaker)
    return { dataUrl: null, error: "Gemini: квота исчерпана (предохранитель) — пропускаю остальные страницы" };
  const models = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];
  let lastError = "неизвестная ошибка";
  for (const model of models) {
    try {
      const parts: unknown[] = [];
      for (const ref of referencePhotos.slice(0, 2)) {
        const data = ref.split(",")[1];
        if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
      }
      parts.push({ text: prompt });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": keys.gemini },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
        }
      );
      const body = await res.text();
      if (!res.ok) throw new Error(extractError(res.status, model, body));
      const j = JSON.parse(body) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> }; finishReason?: string }>;
        promptFeedback?: { blockReason?: string };
      };
      if (j?.promptFeedback?.blockReason) throw new Error(`запрос заблокирован фильтром (blockReason: ${j.promptFeedback.blockReason})`);
      const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error(`модель ответила без картинки (finishReason: ${j?.candidates?.[0]?.finishReason ?? "нет candidates"})`);
      const mime = part.inlineData.mimeType ?? "image/png";
      return { dataUrl: `data:${mime};base64,${part.inlineData.data}`, error: null };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[illustration] Gemini (${model}): ${lastError}`);
      if (isQuotaError(lastError)) {
        quotaBreaker = true;
        break;
      }
      if (!/HTTP 404/i.test(lastError)) break; // 404 — пробуем preview-имя модели
    }
  }
  return { dataUrl: null, error: `Gemini: ${lastError}` };
}

/* ── Hugging Face (Inference Providers) ─────────────────────────────────── */
let hfProviderAuthDead = false;
const HF_MODELS = ["krea/Krea-2-Turbo", "black-forest-labs/FLUX.1-schnell"];
const HF_CLASSIC = ["black-forest-labs/FLUX.1-schnell", "stabilityai/stable-diffusion-3.5-large"];

async function fetchBlobToDataUrl(url: string, init: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  const body = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, "Hugging Face", body));
  const blob = new Blob([body], { type: res.headers.get("content-type") ?? "image/jpeg" });
  return blobToDataUrl(blob);
}

export async function generateImageViaHuggingFace(prompt: string, keys: ApiKeys | null): Promise<ImageCallResult> {
  const key = keys?.huggingface?.trim();
  if (!key) return { dataUrl: null, error: "HUGGINGFACE_API_KEY не задан", via: "huggingface" };
  const errors: string[] = [];

  /* этап A — роутер fal-ai (нужно право «Inference Providers» на токене) */
  if (!hfProviderAuthDead) {
    for (const model of HF_MODELS) {
      try {
        const res = await fetch("https://router.huggingface.co/fal-ai/v1/images/generations", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, prompt, image_size: { width: 1024, height: 1024 } }),
        });
        const body = await res.text();
        if (!res.ok) {
          if (res.status === 401) { hfProviderAuthDead = true; errors.push(extractError(res.status, model, body)); break; }
          throw new Error(extractError(res.status, model, body));
        }
        const j = JSON.parse(body) as { data?: Array<{ url?: string; b64_json?: string }> };
        const item = j?.data?.[0];
        if (item?.b64_json) return { dataUrl: `data:image/jpeg;base64,${item.b64_json}`, error: null, via: "huggingface" };
        if (item?.url) {
          const imgRes = await fetch(item.url);
          if (imgRes.ok) return { dataUrl: await blobToDataUrl(await imgRes.blob()), error: null, via: "huggingface" };
          throw new Error(`не удалось скачать картинку (${imgRes.status})`);
        }
        throw new Error("ответ без картинки");
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
        if (hfProviderAuthDead) break;
      }
    }
  }

  /* этап B — классический hf-inference (работает с обычным токеном) */
  for (const model of HF_CLASSIC) {
    try {
      const dataUrl = await fetchBlobToDataUrl(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ inputs: prompt, parameters: { width: 1024, height: 1024, num_inference_steps: 4 } }),
      });
      return { dataUrl, error: null, via: "huggingface" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`hf-inference/${model}: ${msg}`);
      if (/HTTP 503|loading/i.test(msg)) {
        await delay(8000);
        try {
          const dataUrl = await fetchBlobToDataUrl(`https://router.huggingface.co/hf-inference/models/${model}`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
            body: JSON.stringify({ inputs: prompt, parameters: { width: 1024, height: 1024, num_inference_steps: 4 } }),
          });
          return { dataUrl, error: null, via: "huggingface" };
        } catch (e2) {
          errors.push(`hf-inference/${model} (повтор): ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
      }
    }
  }
  return { dataUrl: null, error: `Hugging Face: ${errors.join("\n")}`, via: "huggingface" };
}

/* ── Pollinations (бесплатно, без ключа) ────────────────────────────────── */
export async function generateImageViaPollinations(prompt: string): Promise<ImageCallResult> {
  try {
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!ct.startsWith("image/")) throw new Error(`ответ не картинка (content-type: ${ct})`);
    return { dataUrl: await blobToDataUrl(await res.blob()), error: null, via: "pollinations" };
  } catch (e) {
    return { dataUrl: null, error: `Pollinations: ${e instanceof Error ? e.message : String(e)}`, via: "pollinations" };
  }
}

/* ── оркестратор выбора провайдера картинок ─────────────────────────────── */
export async function generateIllustration(
  prompt: string,
  referencePhotos: string[],
  keys: ApiKeys | null
): Promise<ImageCallResult> {
  const errors: string[] = [];

  /* YandexART — только через локальный прокси (Yandex не отдаёт CORS-заголовки) */
  if (await isBackendAvailable()) {
    try {
      console.info("[illustration] картинка через прокси /api/yandex/generate-image (YandexART, ключ на сервере)");
      return { dataUrl: await backendGenerateImage(prompt), error: null, via: "yandex-art" };
    } catch (e) {
      errors.push(`Прокси /api/yandex/generate-image: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const gemini = await generateImageViaApi(prompt, referencePhotos, keys);
  if (gemini.dataUrl) return { ...gemini, dataUrl: ensureDataPrefix(gemini.dataUrl) };
  errors.push(`Gemini: ${gemini.error}`);

  if (keys?.huggingface) {
    const hf = await generateImageViaHuggingFace(prompt, keys);
    if (hf.dataUrl) return { ...hf, via: "huggingface" };
    errors.push(`Hugging Face: ${hf.error}`);
  }

  const pol = await generateImageViaPollinations(prompt);
  if (pol.dataUrl) return { ...pol, via: "pollinations" };
  errors.push(pol.error ?? "Pollinations: неизвестная ошибка");
  return { dataUrl: null, error: errors.join("\n"), via: "pollinations" };
}

/* ── Тестовые вызовы (диагностическая панель) — ошибки как есть ─────────── */
const TEST_STYLE_SUFFIX =
  " — hand-drawn children's storybook illustration, watercolor and pencil texture, muted earthy palette, warm light";

export type GeminiTestResult = { ok: true; dataUrl: string; bytesKb: number } | { ok: false; error: string };

const dataUrlKb = (dataUrl: string): number =>
  Math.max(1, Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4 / 1024));

export async function testGeminiImage(prompt: string, apiKey: string): Promise<GeminiTestResult> {
  if (!apiKey.trim())
    return { ok: false, error: "GEMINI_API_KEY пуст. Добавьте ключ в настройках (шестерёнка в шапке) и повторите тест." };
  try {
    const r = await generateImageViaApi(`${prompt.trim()}${TEST_STYLE_SUFFIX}`, [], { ...EMPTY_KEYS, gemini: apiKey.trim() });
    resetQuotaBreaker();
    if (!r.dataUrl) return { ok: false, error: r.error ?? "неизвестная ошибка" };
    return { ok: true, dataUrl: r.dataUrl, bytesKb: dataUrlKb(r.dataUrl) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export async function testHuggingFaceImage(prompt: string, apiKey: string): Promise<GeminiTestResult> {
  if (!apiKey.trim())
    return { ok: false, error: "HUGGINGFACE_API_KEY пуст. Добавьте ключ в настройках (шестерёнка в шапке) и повторите тест." };
  try {
    const r = await generateImageViaHuggingFace(`${prompt.trim()}${TEST_STYLE_SUFFIX}`, { ...EMPTY_KEYS, huggingface: apiKey.trim() });
    if (!r.dataUrl) return { ok: false, error: r.error ?? "неизвестная ошибка" };
    return { ok: true, dataUrl: ensureDataPrefix(r.dataUrl), bytesKb: dataUrlKb(r.dataUrl) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export async function testPollinationsImage(prompt: string): Promise<GeminiTestResult> {
  try {
    const r = await generateImageViaPollinations(`${prompt.trim()}${TEST_STYLE_SUFFIX}`);
    if (!r.dataUrl) return { ok: false, error: r.error ?? "неизвестная ошибка" };
    return { ok: true, dataUrl: r.dataUrl, bytesKb: dataUrlKb(r.dataUrl) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/** Тест YandexGPT через локальный прокси (POST /api/yandex/generate-text) */
export async function testYandexGpt(prompt: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    if (!(await isBackendAvailable()))
      return { ok: false, error: "Yandex не настроен: запустите прокси — npm --prefix server run server (ключи читаются из .env на сервере)." };
    const text = await backendGenerateText(`${prompt.trim()} Ответь двумя-тремя предложениями.`, "", 300);
    return { ok: true, text: text.trim().slice(0, 600) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/** Тест YandexART через локальный прокси (POST /api/yandex/generate-image) */
export async function testYandexArt(prompt: string): Promise<GeminiTestResult> {
  try {
    if (!(await isBackendAvailable()))
      return { ok: false, error: "Yandex не настроен: запустите прокси — npm --prefix server run server (ключи читаются из .env на сервере)." };
    const dataUrl = await backendGenerateImage(`${prompt.trim()}${TEST_STYLE_SUFFIX}`);
    return { ok: true, dataUrl, bytesKb: dataUrlKb(dataUrl) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/* ── лёгкие проверки ключей ─────────────────────────────────────────────── */
export function hfTokenFormatHint(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  if (!t.startsWith("hf_")) return "Токен Hugging Face начинается с «hf_». Похоже, ключ вставлен не полностью или это ключ от другого сервиса.";
  if (t.length < 20) return "Токен выглядит слишком коротким — проверьте, что скопирован целиком.";
  return null;
}

export async function checkGeminiKey(key: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`);
    const body = await res.text();
    if (!res.ok) return { ok: false, detail: extractError(res.status, "models", body) };
    return { ok: true, detail: "ключ валиден — список моделей получен" };
  } catch (e) {
    return { ok: false, detail: `сеть/CORS: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function checkHuggingFaceKey(key: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", { headers: { authorization: `Bearer ${key}` } });
    const body = await res.text();
    if (!res.ok) return { ok: false, detail: extractError(res.status, "whoami", body) };
    const name = (JSON.parse(body) as { name?: string })?.name ?? "токен принят";
    return { ok: true, detail: `токен валиден · пользователь: ${name}` };
  } catch (e) {
    return { ok: false, detail: `сеть/CORS: ${e instanceof Error ? e.message : String(e)}` };
  }
}
