import type { ApiKeys, BookInput, EngineKind, StoryJSON, StoryProvider } from "../types";
import { generateStory as demoGenerateStory, validateStory } from "./storyEngine";
import { delay } from "./utils";

/* ── Провайдер внешних API ─────────────────────────────────────────────────
   В продакшене вызовы идут через локальные эндпоинты /api/generate-story,
   /api/generate-image, /api/moderate (Node/Express держит ключи из .env вне
   браузера). В этой браузерной сборке ключи, которые пользователь сам ввёл в
   настройках, используются для прямых вызовов; без ключей пайплайн честно
   отрабатывает на локальном демо-движке. Ключи никогда не вшиты в код. */

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

/* Claude Sonnet — приоритетный провайдер истории */
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

/* Gemini — запасной провайдер истории: тот же промпт и схема Story JSON,
   только в text-generation endpoint вместо Claude API */
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
    try {
      msg = (JSON.parse(body) as { error?: { message?: string } })?.error?.message ?? body;
    } catch {
      /* показываем тело как есть */
    }
    throw new Error(`gemini ${res.status}: ${msg}`);
  }
  const j = JSON.parse(body) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = (j?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const story = JSON.parse(raw.replace(/```json|```/g, "").trim()) as StoryJSON;
  if (!validateStory(story, input.spread_count)) throw new Error("invalid story json from gemini");
  return story;
}

/** Narrative Module: приоритет Claude Sonnet; если ключа Anthropic нет (или вызов
    упал) — автоматический фолбэк на Gemini; без ключей — локальный движок.
    `provider` позволяет форсировать провайдера: "anthropic" | "gemini". */
export async function generateStoryViaApi(
  input: BookInput,
  keys: ApiKeys | null,
  seed: number,
  provider?: StoryProvider
): Promise<StoryResult> {
  const want: StoryProvider | null =
    provider ?? (keys?.anthropic ? "anthropic" : keys?.gemini ? "gemini" : null);

  if (want === "anthropic" && keys?.anthropic) {
    try {
      return { story: await storyFromClaude(keys.anthropic, input, seed), engine: "gemini+claude" };
    } catch (e) {
      console.warn("[narrative] Claude недоступен:", e);
      if (keys?.gemini) console.info("[narrative] авто-фолбэк: история через Gemini");
    }
  }
  if (keys?.gemini && (want === "gemini" || want === "anthropic")) {
    try {
      return { story: await storyFromGemini(keys.gemini, input, seed), engine: "gemini" };
    } catch (e) {
      console.warn("[narrative] Gemini недоступен, фолбэк на демо-движок:", e);
    }
  }
  return { story: demoGenerateStory(input, seed), engine: "demo" };
}

/* ── Illustration Module: провайдеры картинок ─────────────────────────────
   Ошибки НИКОГДА не глотаем: возвращается читаемый текст (HTTP-статус +
   error.message / blockReason / finishReason). Порядок: Gemini → Hugging
   Face (запасной) → null (пайплайн рисует демо-движком). */

export interface ImageCallResult {
  dataUrl: string | null;
  error: string | null;
  /** какой провайдер отработал (или пытался последним) */
  via?: "gemini" | "huggingface";
}

const extractError = (status: number, context: string, body: string): string => {
  let msg = body;
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    // Gemini: {error:{message}}, роутер HF: {error:"строка"} — обе формы
    msg = (typeof j?.error === "string" ? j.error : j?.error?.message) ?? j?.message ?? body;
  } catch {
    /* тело не JSON — показываем как есть */
  }
  return `HTTP ${status} · ${context}: ${msg}`;
};

/* ── Gemini (Nano Banana) ───────────────────────────────────────────────── */
const IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"] as const;
const MODEL_FALLBACK_RE = /HTTP 404|not found|Unsupported|not supported/i;
const SAFETY_BLOCK_RE = /заблокирован|blockReason|finishReason|SAFETY|safety|policy|prohibited|IMAGE_SAFETY/i;
export const QUOTA_RE = /429|quota|rate.?limit|exceeded|RESOURCE_EXHAUSTED/i;

export const isQuotaError = (e: string | null | undefined): boolean => !!e && QUOTA_RE.test(e);

/** Предохранитель: после первой ошибки квоты не долбим API на каждой странице */
let quotaBreaker = false;
export function resetQuotaBreaker(): void {
  quotaBreaker = false;
  hfProviderAuthDead = false;
}

async function callGeminiImage(model: string, prompt: string, referencePhotos: string[], key: string): Promise<string> {
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
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, model, body));
  const j = JSON.parse(body) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (j?.promptFeedback?.blockReason)
    throw new Error(`запрос заблокирован фильтром (blockReason: ${j.promptFeedback.blockReason})`);
  const cand = j?.candidates?.[0];
  const part = cand?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data)
    throw new Error(`модель ответила без картинки (finishReason: ${cand?.finishReason ?? "нет candidates"})`);
  return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
}

/** Пробуем GA-имя модели, при 404 — preview-имя. Если фильтр безопасности
    отклонил запрос с референс-фото — повторяем БЕЗ фото. При ошибке квоты
    взводим предохранитель. */
export async function generateImageViaApi(
  prompt: string,
  referencePhotos: string[],
  keys: ApiKeys | null
): Promise<ImageCallResult> {
  if (!keys?.gemini) return { dataUrl: null, error: "GEMINI_API_KEY не задан", via: "gemini" };
  if (quotaBreaker)
    return { dataUrl: null, error: "пропущено: у ключа нулевая квота (предохранитель взведён)", via: "gemini" };
  let lastError = "неизвестная ошибка";
  let model: string = IMAGE_MODELS[0];
  for (const m of IMAGE_MODELS) {
    model = m;
    try {
      return { dataUrl: await callGeminiImage(m, prompt, referencePhotos, keys.gemini), error: null, via: "gemini" };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (!MODEL_FALLBACK_RE.test(lastError)) break;
    }
  }
  if (referencePhotos.length > 0 && SAFETY_BLOCK_RE.test(lastError)) {
    try {
      const dataUrl = await callGeminiImage(model, prompt, [], keys.gemini);
      console.info("[illustration] референс-фото отклонено фильтром — повтор без фото удался");
      return { dataUrl, error: null, via: "gemini" };
    } catch (e2) {
      lastError = `с референс-фото: ${lastError} · без фото: ${e2 instanceof Error ? e2.message : String(e2)}`;
    }
  }
  if (QUOTA_RE.test(lastError)) {
    quotaBreaker = true;
    lastError +=
      "\n→ У ключа нулевой бесплатный лимит генерации изображений (free_tier limit: 0). " +
      "Решение: Google AI Studio → Settings → Plan & Billing → включить платный тариф (есть бесплатный порог), либо другой ключ.";
  }
  console.warn(`[illustration] Gemini: ${lastError}`);
  return { dataUrl: null, error: lastError, via: "gemini" };
}

/* ── Hugging Face (Inference Providers, provider=fal-ai) ──────────────────
   Запасной провайдер иллюстраций: krea/Krea-2-Turbo, фолбэк на
   black-forest-labs/FLUX.1-schnell. Тот же промпт/стиль, что идёт в Gemini.

   ВАЖНО: используется OpenAI-совместимый маршрут роутера
   /fal-ai/v1/images/generations с моделью в теле запроса и HF-токеном в
   Authorization. Нативные маршруты fal (/fal-ai/v1/{model}) требуют ключ fal
   и отвечают «Invalid username or password» на HF-токен. */
const HF_ENDPOINT = "https://router.huggingface.co/fal-ai/v1/images/generations";
const HF_MODELS = ["krea/Krea-2-Turbo", "black-forest-labs/FLUX.1-schnell"] as const;

/** «эта модель недоступна — попробуй следующую» vs «токен плохой — дальше нет смысла» */
const HF_NEXT_MODEL_RE = /not supported|not found|does not exist|gated|access to this model|license|agree/i;
const HF_AUTH_FAIL_RE = /invalid username|invalid api key|invalid token|unauthorized/i;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("не удалось прочитать картинку (blob)"));
    fr.readAsDataURL(blob);
  });

async function callHuggingFaceImage(model: string, prompt: string, key: string): Promise<string> {
  const res = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
  });
  const body = await res.text();
  if (!res.ok) {
    let msg = extractError(res.status, model, body);
    if (/gated|access to this model|license|agree/i.test(msg))
      msg +=
        "\n→ Модель с ограниченным доступом: откройте её карточку на huggingface.co и нажмите «Agree and access», затем повторите.";
    else if (HF_AUTH_FAIL_RE.test(msg))
      msg +=
        "\n→ Токен без права «Inference Providers» (fine-grained: inference.serverless.write). Приложение автоматически попробует классический маршрут hf-inference — он работает с обычным токеном.";
    throw new Error(msg);
  }
  const j = JSON.parse(body) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    images?: Array<{ url?: string; b64_json?: string }>;
  };
  const item: { url?: string; b64_json?: string } | undefined = j?.data?.[0] ?? j?.images?.[0];
  if (item?.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
  const url = item?.url;
  if (!url) throw new Error(`Hugging Face (${model}) вернул ответ без картинки: ${body.slice(0, 300)}`);
  const img = await fetch(url);
  if (!img.ok) throw new Error(`картинка сгенерирована, но недоступна по URL (HTTP ${img.status})`);
  return blobToDataUrl(await img.blob());
}

/* ── этап B: классический маршрут Inference (provider hf-inference) ────────
   POST router.huggingface.co/hf-inference/models/{model}, {"inputs": …} →
   сырые байты картинки. Работает с ОБЫЧНЫМ HF-токеном (хватает даже
   read-only) — право «Inference Providers» не требуется, в отличие от
   маршрута fal-ai. Модели проверены по живому списку тёплых серверлесс-
   моделей HF (inference=warm, text-to-image), обе не gated. */
const HF_CLASSIC_MODELS = ["black-forest-labs/FLUX.1-schnell", "stabilityai/stable-diffusion-3.5-large"] as const;

async function callHfClassicImage(model: string, prompt: string, key: string, retried = false): Promise<string> {
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { width: 1024, height: 1024, num_inference_steps: 4 }, // schnell рассчитана на 1–4 шага
    }),
  });
  const blob = await res.blob();
  if (!res.ok) {
    let msg = extractError(res.status, `hf-inference/${model}`, await blob.text());
    if (/loading|currently loading/i.test(msg) && !retried) {
      // холодный старт модели — даём ей проснуться и пробуем ещё раз
      await delay(8000);
      return callHfClassicImage(model, prompt, key, true);
    }
    throw new Error(msg);
  }
  if (blob.type.startsWith("image/") || blob.size > 20_000) return blobToDataUrl(blob);
  // на всякий случай — JSON-вариант ответа (url/base64)
  const body = await blob.text();
  try {
    const j = JSON.parse(body) as { url?: string; b64_json?: string; image?: string };
    if (j?.b64_json) return `data:image/jpeg;base64,${j.b64_json}`;
    if (j?.image) return `data:image/jpeg;base64,${j.image}`;
    if (j?.url) {
      const img = await fetch(j.url);
      if (img.ok) return blobToDataUrl(await img.blob());
    }
  } catch {
    /* не JSON — считаем сырыми байтами картинки */
  }
  return blobToDataUrl(blob);
}

/** 401 от fal-ai = токен без права Inference Providers; за прогон не «выздоровеет» */
let hfProviderAuthDead = false;

export async function generateImageViaHuggingFace(prompt: string, keys: ApiKeys | null): Promise<ImageCallResult> {
  if (!keys?.huggingface) return { dataUrl: null, error: "HUGGINGFACE_API_KEY не задан", via: "huggingface" };
  const stageErrors: string[] = [];

  /* этап A: fal-ai через OpenAI-маршрут (Krea-2-Turbo → FLUX.1-schnell) */
  if (!hfProviderAuthDead) {
    for (const model of HF_MODELS) {
      try {
        return { dataUrl: await callHuggingFaceImage(model, prompt, keys.huggingface), error: null, via: "huggingface" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        stageErrors.push(msg);
        if (HF_AUTH_FAIL_RE.test(msg) && !HF_NEXT_MODEL_RE.test(msg)) {
          hfProviderAuthDead = true; // не долбить fal на каждой странице
          break;
        }
        if (!HF_NEXT_MODEL_RE.test(msg)) break;
      }
    }
  } else {
    stageErrors.push("fal-ai пропущен: токен без права «Inference Providers» (HTTP 401)");
  }

  /* этап B: классический hf-inference — обычный токен проходит */
  for (const model of HF_CLASSIC_MODELS) {
    try {
      const dataUrl = await callHfClassicImage(model, prompt, keys.huggingface);
      if (stageErrors.length)
        console.info(`[illustration] HF: fal-ai не сработал — классический маршрут hf-inference/${model} спас`);
      return { dataUrl, error: null, via: "huggingface" };
    } catch (e) {
      stageErrors.push(`hf-inference/${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const lastError = stageErrors.join("\n");
  console.warn(`[illustration] Hugging Face: ${lastError}`);
  return { dataUrl: null, error: lastError, via: "huggingface" };
}

/** Illustration Module: выбор провайдера. Gemini — первый; если ключ не задан
    или вызов упал (квота/регион/фильтр) и есть HUGGINGFACE_API_KEY — пробуем
    Hugging Face с тем же промптом. Оба упали → null, пайплайн рисует демо. */
export async function generateIllustration(
  prompt: string,
  referencePhotos: string[],
  keys: ApiKeys | null
): Promise<ImageCallResult> {
  const gemini = await generateImageViaApi(prompt, referencePhotos, keys);
  if (gemini.dataUrl) return gemini;
  if (keys?.huggingface) {
    console.info(`[illustration] Gemini не смог (${gemini.error}) — пробуем Hugging Face (fal-ai)`);
    const hf = await generateImageViaHuggingFace(prompt, keys);
    if (hf.dataUrl) return { ...hf, via: "huggingface" };
    return { dataUrl: null, error: `Gemini: ${gemini.error}\nHugging Face: ${hf.error}`, via: "huggingface" };
  }
  return gemini;
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
    const r = await generateImageViaApi(`${prompt.trim()}${TEST_STYLE_SUFFIX}`, [], {
      gemini: apiKey.trim(),
      anthropic: "",
      huggingface: "",
    });
    resetQuotaBreaker(); // тест не должен взводить предохранитель пайплайна
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
    const r = await generateImageViaHuggingFace(`${prompt.trim()}${TEST_STYLE_SUFFIX}`, {
      gemini: "",
      anthropic: "",
      huggingface: apiKey.trim(),
    });
    if (!r.dataUrl) return { ok: false, error: r.error ?? "неизвестная ошибка" };
    return { ok: true, dataUrl: r.dataUrl, bytesKb: dataUrlKb(r.dataUrl) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/** Быстрая проверка ключа Gemini: дешёвый GET models?pageSize=1 */
export async function checkGeminiKey(key: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`
    );
    const body = await res.text();
    if (!res.ok) return { ok: false, detail: extractError(res.status, "models", body) };
    return { ok: true, detail: "ключ валиден — список моделей получен" };
  } catch (e) {
    return { ok: false, detail: `сеть/CORS: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Проверка токена Hugging Face: whoami-v2 */
export async function checkHuggingFaceKey(key: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: токен не принят huggingface.co` };
    const j = (await res.json()) as { name?: string };
    return { ok: true, detail: `токен валиден — пользователь ${j?.name ?? "без имени"}` };
  } catch (e) {
    return { ok: false, detail: `сеть/CORS: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ── ключи (только localStorage пользователя, никогда не в коде) ────────── */
const KEYS_STORAGE = "skazka.apikeys.v1";
const EMPTY_KEYS: ApiKeys = { gemini: "", anthropic: "", huggingface: "" };

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (raw) return { ...EMPTY_KEYS, ...(JSON.parse(raw) as Partial<ApiKeys>) };
  } catch {
    /* noop */
  }
  return { ...EMPTY_KEYS };
}

export function saveKeys(keys: ApiKeys): void {
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    /* noop */
  }
}
