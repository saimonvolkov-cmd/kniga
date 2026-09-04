import { useState } from "react";
import type { ApiKeys } from "../types";
import {
  detectConnection, testHuggingFaceImage, testPollinationsImage, testYandexArt, testYandexGpt,
  type GeminiTestResult,
} from "../lib/api";
import { testGeminiImage } from "../lib/api";
import { ChunkyButton, cx } from "./ui";
import { IconCamera, IconGear } from "./icons";

const DEFAULT_PROMPT = "нарисуй лису в детской книжной иллюстрации";

type Provider = "gemini" | "yandex-gpt" | "yandex-art" | "hf" | "pollinations";
const LABEL: Record<Provider, string> = {
  gemini: "Gemini",
  "yandex-gpt": "YandexGPT",
  "yandex-art": "YandexART",
  hf: "Hugging Face",
  pollinations: "Pollinations",
};

type TestOutcome = { provider: string } & (GeminiTestResult | { ok: true; text: string });

/** Диагностика провайдеров — отдельно от основного потока опроса */
export function ApiTestPanel({ keys, onOpenSettings }: { keys: ApiKeys; onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState<null | Provider>(null);
  const [result, setResult] = useState<TestOutcome | null>(null);
  const [yandexOn, setYandexOn] = useState<boolean | null>(null);

  const probe = () => {
    if (yandexOn !== null) return;
    void detectConnection(true).then((m) => setYandexOn(m === "backend"));
  };

  const run = async (provider: Provider) => {
    setLoading(provider);
    setResult(null);
    const r =
      provider === "gemini"
        ? await testGeminiImage(prompt, keys.gemini)
        : provider === "hf"
          ? await testHuggingFaceImage(prompt, keys.huggingface)
          : provider === "yandex-gpt"
            ? await testYandexGpt(prompt)
            : provider === "yandex-art"
              ? await testYandexArt(prompt)
              : await testPollinationsImage(prompt);
    setResult({ provider: LABEL[provider], ...r });
    setLoading(null);
    if (r.ok) console.info(`[ApiTest:${provider}] ответ получен`, "bytesKb" in r ? `~${r.bytesKb} КБ` : "(текст)");
    else console.error(`[ApiTest:${provider}] ошибка:\n${r.error}`);
  };

  return (
    <div className="card-paper overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); probe(); }}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-ink bg-sea text-paper">
            <IconCamera className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block font-display text-[14px] font-bold leading-tight text-pine">Тест генерации</span>
            <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-ink/45">
              Yandex · Gemini · HF · Pollinations
            </span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={cx("h-4 w-4 shrink-0 text-ink/50 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="animate-rise border-t-2 border-dashed border-ink/15 p-4">
          <p className={cx(
            "mb-3 flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-[11.5px] font-extrabold leading-snug",
            yandexOn === null ? "border-ink/15 bg-foam text-ink/50"
              : yandexOn ? "border-fern bg-fern/10 text-moss" : "border-marigold bg-marigold/15 text-pine"
          )}>
            <i className={cx("h-2.5 w-2.5 shrink-0 rounded-full", yandexOn === null ? "bg-ink/30" : yandexOn ? "animate-pulse-dot bg-fern" : "bg-marigold")} />
            {yandexOn === null
              ? "определяю Yandex-прокси…"
              : yandexOn
                ? "Yandex настроен на сервере · ключ в серверном .env"
                : "Yandex не настроен · запусти npm --prefix server run server"}
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block font-display text-[12px] font-bold uppercase tracking-wider text-ink/50">Промпт</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="field-input w-full resize-none px-3 py-2 text-[13.5px] font-bold text-pine" />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <ChunkyButton variant="primary" onClick={() => void run("yandex-art")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "yandex-art" ? "Рисует…" : "Проверить YandexART"}
            </ChunkyButton>
            <ChunkyButton variant="dark" onClick={() => void run("yandex-gpt")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "yandex-gpt" ? "Пишет…" : "Проверить YandexGPT"}
            </ChunkyButton>
            <ChunkyButton variant="dark" onClick={() => void run("gemini")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "gemini" ? "Рисует…" : "Gemini"}
            </ChunkyButton>
            <ChunkyButton variant="coral" onClick={() => void run("hf")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "hf" ? "Рисует…" : "Hugging Face"}
            </ChunkyButton>
            <ChunkyButton variant="ghost" onClick={() => void run("pollinations")} disabled={loading !== null} className="col-span-2 px-2 py-2.5 text-[12.5px]">
              {loading === "pollinations" ? "Рисует…" : "Без ключа (Pollinations)"}
            </ChunkyButton>
          </div>

          {!keys.gemini && !keys.huggingface && (
            <p className="mt-2.5 text-[11px] font-bold leading-snug text-ink/45">
              Ключи Gemini / HF — в настройках:
              <button type="button" onClick={onOpenSettings} className="mx-1 inline-flex items-center gap-1 rounded-lg border-2 border-ink/25 px-2 py-0.5 font-display text-[11px] text-ink/60 transition-colors hover:border-ink hover:text-pine">
                <IconGear className="h-3.5 w-3.5" /> открыть
              </button>
            </p>
          )}

          {loading && (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink/25 py-6">
              {[0, 1, 2].map((i) => (
                <i key={i} className="animate-dot h-2.5 w-2.5 rounded-full bg-sea" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}

          {result && !loading && result.ok && "dataUrl" in result && (
            <figure className="animate-pop mt-3">
              <img src={result.dataUrl} alt="Тестовая иллюстрация" className="rounded-xl border-[2.5px] border-ink shadow-block-sm" />
              <figcaption className="mt-1.5 text-center text-[11.5px] font-extrabold text-moss">
                {result.provider}: успех · ~{result.bytesKb.toLocaleString("ru-RU")} КБ
              </figcaption>
            </figure>
          )}

          {result && !loading && result.ok && "text" in result && (
            <div className="animate-pop mt-3 overflow-hidden rounded-xl border-[2.5px] border-fern">
              <p className="bg-fern px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-paper">
                {result.provider}: успех — вот что он написал
              </p>
              <pre className="log-scroll max-h-44 overflow-auto whitespace-pre-wrap bg-paper p-3 font-body text-[12.5px] font-semibold leading-relaxed text-pine">
{result.text}
              </pre>
            </div>
          )}

          {result && !loading && !result.ok && (
            <div className="animate-pop mt-3 overflow-hidden rounded-xl border-[2.5px] border-coral">
              <p className="bg-coral px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-paper">
                {result.provider} — ошибка, как есть
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
