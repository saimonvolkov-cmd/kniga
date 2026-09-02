import type { ApiKeys, BookInput, StoryJSON } from "../types";
import { generateStory as demoGenerateStory, validateStory } from "./storyEngine";

/* ── Провайдер внешних API ─────────────────────────────────────────────────
   В продакшене эти вызовы идут через локальные эндпоинты /api/generate-story,
   /api/generate-image, /api/moderate (Node/Express держит ключи из .env вне
   браузера). В этой браузерной сборке ключи, которые пользователь сам ввёл в
   настройках, используются для прямых вызовов Gemini / Claude; без ключей
   пайплайн честно отрабатывает на локальном демо-движке. */

export interface StoryResult {
  story: StoryJSON;
  engine: "demo" | "gemini+claude";
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

/** Narrative Module: Claude Sonnet → Story JSON; фолбэк — локальный движок */
export async function generateStoryViaApi(input: BookInput, keys: ApiKeys | null, seed: number): Promise<StoryResult> {
  if (keys?.anthropic) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": keys.anthropic,
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
      if (validateStory(story, input.spread_count)) return { story, engine: "gemini+claude" };
      throw new Error("invalid story json");
    } catch (e) {
      console.warn("[narrative] Claude недоступен, фолбэк на демо-движок:", e);
    }
  }
  return { story: demoGenerateStory(input, seed), engine: "demo" };
}

/** Illustration Module: Gemini (Nano Banana) с референс-фото; фолбэк — демо-SVG */
export async function generateImageViaApi(
  prompt: string,
  referencePhotos: string[],
  keys: ApiKeys | null
): Promise<string | null> {
  if (!keys?.gemini) return null;
  try {
    const parts: unknown[] = [];
    for (const ref of referencePhotos.slice(0, 2)) {
      const data = ref.split(",")[1];
      if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
    }
    parts.push({ text: prompt });
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": keys.gemini },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const j = await res.json();
    const part = j?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData?.data);
    if (!part) throw new Error("no image in response");
    return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
  } catch (e) {
    console.warn("[illustration] Gemini недоступен, фолбэк на демо-иллюстрацию:", e);
    return null;
  }
}

const KEYS_STORAGE = "skazka.apikeys.v1";

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (raw) return JSON.parse(raw) as ApiKeys;
  } catch {
    /* noop */
  }
  return { gemini: "", anthropic: "" };
}

export function saveKeys(keys: ApiKeys): void {
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    /* noop */
  }
}
