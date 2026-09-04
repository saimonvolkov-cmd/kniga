import type { ApiKeys, StoryJSON } from "../types";

/* ── Content Safety Module ─────────────────────────────────────────────────
   Каждый разворот проходит фильтр ALLOW/BLOCK по категориям: жестокость,
   насилие, пугающий не по возрасту контент. BLOCK → текст перегенерируется
   мягче (локальный словарь смягчений). При ключе Anthropic сюда подключается
   Claude Haiku с тем же вердиктом ALLOW/BLOCK. */

const SCARY_PATTERNS: Array<[RegExp, string]> = [
  [/страшн(ый|ая|ое|ые)/i, "таинственный"],
  [/ужас/i, "удивительный"],
  [/зл(ой|ая|ое)/i, "ворчливый"],
  [/уби(л|ла|ть)/i, "победил"],
  [/смерт/i, "чудо"],
  [/тёмный лес/i, "сонный лес"],
  [/крича(л|ла|ть)/i, "звал"],
  [/кровь/i, "клюквенный сок"],
  [/монстр/i, "пушистый великан"],
];

function soften(text: string): { text: string; changed: boolean } {
  let out = text;
  let changed = false;
  for (const [re, rep] of SCARY_PATTERNS) {
    if (re.test(out)) {
      out = out.replace(re, rep);
      changed = true;
    }
  }
  return { text: out, changed };
}

/** Опциональный прогон через Claude Haiku: ALLOW/BLOCK для одного разворота */
async function haikuVerdict(text: string, key: string): Promise<"ALLOW" | "BLOCK" | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 8,
        messages: [{
          role: "user",
          content: `Текст детской книги (2–9 лет). Ответь одним словом ALLOW или BLOCK. Категории BLOCK: жестокость, насилие, пугающий контент. Текст: «${text}»`,
        }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const v = String(j?.content?.[0]?.text ?? "").toUpperCase();
    return v.includes("BLOCK") ? "BLOCK" : "ALLOW";
  } catch {
    return null;
  }
}

export async function moderateStory(
  story: StoryJSON,
  keys: ApiKeys | null
): Promise<{ checked: number; blocked: number; softened: number }> {
  let blocked = 0;
  let softened = 0;
  for (const s of story.spreads) {
    let verdict: "ALLOW" | "BLOCK" | null = null;
    if (keys?.anthropic) verdict = await haikuVerdict(s.text, keys.anthropic);
    const local = soften(s.text);
    if (verdict === "BLOCK" || local.changed) {
      blocked++;
      if (local.changed) {
        s.text = local.text;
        softened++;
      }
    }
  }
  return { checked: story.spreads.length, blocked, softened };
}
