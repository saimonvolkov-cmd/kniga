import { useState } from "react";
import type { ApiKeys } from "../types";
import { testGeminiImage, testHuggingFaceImage, type GeminiTestResult } from "../lib/api";
import { ChunkyButton, cx } from "./ui";
import { IconCamera, IconGear } from "./icons";

const DEFAULT_PROMPT = "нарисуй лису в детской книжной иллюстрации";

/** Диагностика подключения провайдеров — отдельно от основного потока опроса */
export function ApiTestPanel({ keys, onOpenSettings }: { keys: ApiKeys; onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState<null | "gemini" | "hf">(null);
  const [result, setResult] = useState<{ provider: "Gemini" | "Hugging Face" } & GeminiTestResult | null>(null);

  const run = async (provider: "gemini" | "hf") => {
    setLoading(provider);
    setResult(null);
    const r = provider === "gemini"
      ? await testGeminiImage(prompt, keys.gemini)
      : await testHuggingFaceImage(prompt, keys.huggingface);
    setResult({ provider: provider === "gemini" ? "Gemini" : "Hugging Face", ...r });
    setLoading(null);
    if (r.ok) console.info(`[ApiTest:${provider}] изображение получено, ~${r.bytesKb} КБ`);
    else console.error(`[ApiTest:${provider}] ошибка:\n${r.error}`);
  };

  const hasAnyKey = Boolean(keys.gemini.trim() || keys.huggingface.trim());

  return (
    <div className="card-paper overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2.5">
          <span className={cx("grid h-9 w-9 place-items-center rounded-xl border-2 border-ink", hasAnyKey ? "bg-sea text-paper" : "bg-foam text-ink/50")}>
            <IconCamera className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block font-display text-[14px] font-bold leading-tight text-pine">Тест Gemini / Hugging Face</span>
            <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-ink/45">
              {hasAnyKey ? "проверить генерацию картинок" : "ключи не заданы"}
            </span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={cx("h-4 w-4 shrink-0 text-ink/50 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="animate-rise border-t-2 border-dashed border-ink/15 p-4">
          {!hasAnyKey && (
            <div className="mb-3 rounded-xl border-2 border-ink/15 bg-foam p-3 text-[12.5px] font-bold text-ink/65">
              Без GEMINI_API_KEY или HUGGINGFACE_API_KEY тест не сработает.
              <ChunkyButton variant="ghost" onClick={onOpenSettings} className="mt-2 w-full py-2 text-[13px]">
                <IconGear className="h-4 w-4" /> Открыть настройки ключей
              </ChunkyButton>
            </div>
          )}
          <label className="mb-3 block">
            <span className="mb-1 block font-display text-[12px] font-bold uppercase tracking-wider text-ink/50">Промпт</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="field-input w-full resize-none px-3 py-2 text-[13.5px] font-bold text-pine" />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <ChunkyButton variant="dark" onClick={() => void run("gemini")} disabled={loading !== null} className="py-2.5 text-[13px]">
              {loading === "gemini" ? "Gemini рисует…" : "Тест Gemini"}
            </ChunkyButton>
            <ChunkyButton variant="coral" onClick={() => void run("hf")} disabled={loading !== null} className="py-2.5 text-[13px]">
              {loading === "hf" ? "HF рисует…" : "Проверить Hugging Face"}
            </ChunkyButton>
          </div>

          {loading && (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink/25 py-6">
              {[0, 1, 2].map((i) => (
                <i key={i} className="animate-dot h-2.5 w-2.5 rounded-full bg-sea" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}

          {result && !loading && "ok" in result && result.ok && (
            <figure className="animate-pop mt-3">
              <img src={result.dataUrl} alt="Тестовая иллюстрация" className="rounded-xl border-[2.5px] border-ink shadow-block-sm" />
              <figcaption className="mt-1.5 text-center text-[11.5px] font-extrabold text-moss">
                {result.provider}: подключение работает · ~{result.bytesKb.toLocaleString("ru-RU")} КБ
              </figcaption>
            </figure>
          )}

          {result && !loading && "ok" in result && !result.ok && (
            <div className="animate-pop mt-3 overflow-hidden rounded-xl border-[2.5px] border-coral">
              <p className="bg-coral px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-paper">
                {result.provider} — ошибка от API, как есть
              </p>
              <pre className="log-scroll max-h-44 overflow-auto whitespace-pre-wrap bg-paper p-3 font-mono text-[11px] font-semibold leading-relaxed text-coral">
{result.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
