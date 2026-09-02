import type { ApiKeys, StoryJSON } from "../types";

/* ── Content Safety Module ─────────────────────────────────────────────────
   Прогоняет текст каждого разворота через фильтр (Claude Haiku при наличии
   ключа, иначе локальная эвристика). Категории: жестокость, насилие,
   пугающий не по возрасту контент. При BLOCK — текст смягчается. */

export interface SafetyReport {
  checked: number;
  blocked: number;
  softened: number;
  flags: Array<{ spread: number; reason: string }>;
}

const BLOCK_PATTERNS: Array<[RegExp, string]> = [
  [/(уби[вл]|убийств|зареза|застрел)/i, "насилие"],
  [/(кровь|кровотеч)/i, "жестокость"],
  [/(смерть|умер|умира|погиб|похорон)/i, "пугающий контент"],
  [/(страшн.*монстр|чудовищ.*съе|съест тебя)/i, "пугающий контент"],
  [/(ударил|пнул|избил|отлупил)/i, "насилие"],
  [/(тёмная сила поглотит|тебя заберут навсегда)/i, "пугающий контент"],
];

export function heuristicModerate(text: string): { allow: boolean; reason?: string } {
  for (const [re, reason] of BLOCK_PATTERNS) if (re.test(text)) return { allow: false, reason };
  return { allow: true };
}

const SOFTEN: Array<[RegExp, string]> = [
  [/страшно/gi, "немного волшебно"],
  [/тёмный лес/gi, "сонный лес"],
  [/кричал от ужаса/gi, "громко охнул"],
  [/дрожал от страха/gi, "переминался с ноги на ногу"],
];

export function softenText(text: string): string {
  let out = text;
  for (const [re, rep] of SOFTEN) out = out.replace(re, rep);
  return out;
}

/** Вызов Claude Haiku: пакетный ALLOW/BLOCK по всем разворотам */
async function claudeModerate(story: StoryJSON, keys: ApiKeys): Promise<boolean[]> {
  const list = story.spreads.map((s, i) => `[${i + 1}] ${s.text}`).join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": keys.anthropic,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content:
            "Ты — фильтр безопасности детской книги (возраст 2–9 лет). Категории: жестокость, насилие, пугающий не по возрасту контент.\n" +
            "Для каждой строки ответь строго ALLOW или BLOCK. Верни ТОЛЬКО JSON-массив, например [\"ALLOW\",\"BLOCK\"].\n\n" + list,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`haiku ${res.status}`);
  const j = await res.json();
  const text: string = j?.content?.[0]?.text ?? "[]";
  const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
  if (!Array.isArray(arr) || arr.length !== story.spreads.length) throw new Error("bad haiku shape");
  return arr.map((v: string) => String(v).toUpperCase().includes("BLOCK"));
}

export async function moderateStory(story: StoryJSON, keys: ApiKeys | null): Promise<SafetyReport> {
  const report: SafetyReport = { checked: story.spreads.length, blocked: 0, softened: 0, flags: [] };
  let blockedFlags: boolean[] = [];

  if (keys?.anthropic) {
    try {
      blockedFlags = await claudeModerate(story, keys);
    } catch {
      blockedFlags = story.spreads.map((s) => !heuristicModerate(s.text).allow);
    }
  } else {
    blockedFlags = story.spreads.map((s) => !heuristicModerate(s.text).allow);
  }

  story.spreads.forEach((s, i) => {
    if (blockedFlags[i]) {
      report.blocked++;
      report.softened++;
      report.flags.push({ spread: s.spread_number, reason: heuristicModerate(s.text).reason ?? "фильтр Claude Haiku" });
      s.text = softenText(s.text);
    }
  });
  return report;
}
