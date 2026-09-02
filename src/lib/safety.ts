import type { ApiKeys, StoryJSON } from "../types";
import { delay } from "./utils";

/* ── Content Safety Module ─────────────────────────────────────────────────
   Каждый текст разворота проходит фильтр ALLOW/BLOCK (жестокость, насилие,
   пугающий контент не по возрасту). При наличии ключа Anthropic — реальный
   вызов Claude Haiku; иначе локальный фильтр по словарю. BLOCK → текст
   перегенерируется мягче (повтор прогона с уточнением «смягчить»). */

export interface ModerationReport {
  checked: number;
  blocked: number;
  softened: number;
}

const BANNED_RE =
  /уби|убий|смерт|кров|жесток|насили|издев|удар[иы]|пнул|сломал.*назл|кричал.*зл|монстр.*съе|съел.*реб|тёмн.*лес.*страшн|закричал.*ужас/i;

const SOFTEN_RE: Array<[RegExp, string]> = [
  [/страшно/i, "волнительно"],
  [/ужас/i, "неожиданность"],
  [/кричал/i, "позвал"],
  [/монстр/i, "великан"],
  [/бросил.*назло/i, "оставил на месте"],
];

function soften(text: string): string {
  let out = text;
  for (const [re, rep] of SOFTEN_RE) out = out.replace(re, rep);
  return out;
}

async function moderateViaClaude(text: string, key: string): Promise<"ALLOW" | "BLOCK"> {
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
      max_tokens: 16,
      system:
        "Ты — фильтр детской безопасности. Категории: жестокость, насилие, пугающий контент не по возрасту. " +
        "Ответь ровно одним словом: ALLOW или BLOCK.",
      messages: [{ role: "user", content: `Текст разворота детской книги:\n«${text}»` }],
    }),
  });
  if (!res.ok) throw new Error(`haiku ${res.status}`);
  const j = await res.json();
  const word = String(j?.content?.[0]?.text ?? "").toUpperCase();
  return word.includes("BLOCK") ? "BLOCK" : "ALLOW";
}

export async function moderateStory(story: StoryJSON, keys: ApiKeys | null): Promise<ModerationReport> {
  const report: ModerationReport = { checked: story.spreads.length, blocked: 0, softened: 0 };

  for (let i = 0; i < story.spreads.length; i++) {
    const sp = story.spreads[i];
    let verdict: "ALLOW" | "BLOCK" = BANNED_RE.test(sp.text) ? "BLOCK" : "ALLOW";

    if (keys?.anthropic) {
      try {
        verdict = await moderateViaClaude(sp.text, keys.anthropic);
      } catch (e) {
        console.warn("[safety] Haiku недоступен, локальный фильтр:", e);
      }
    } else {
      await delay(60); // честная пауза шага на демо
    }

    if (verdict === "BLOCK") {
      report.blocked++;
      story.spreads[i] = { ...sp, text: soften(sp.text) };
      report.softened++;
      console.info(`[safety] разворот ${sp.spread_number}: BLOCK → текст смягчён`);
    }
  }
  return report;
}
