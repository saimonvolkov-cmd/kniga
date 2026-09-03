import { useState } from "react";
import type { ApiKeys } from "../types";
import {
  testGeminiImage, testHuggingFaceImage, testPollinationsImage, testYandexArt, testYandexGpt,
  type GeminiTestResult,
} from "../lib/api";
import { ChunkyButton, cx } from "./ui";
import { IconCamera, IconGear } from "./icons";

const DEFAULT_PROMPT = "нарисуй лису в детской книжной иллюстрации";

type Provider = "gemini" | "hf" | "pollinations" | "yandex-gpt" | "yandex-art";
const PROVIDER_LABEL: Record<Provider, string> = {
  gemini: "Gemini",
  hf: "Hugging Face",
  pollinations: "Pollinations",
  "yandex-gpt": "YandexGPT",
  "yandex-art": "YandexART",
};

type TestOutcome = { provider: string } & (GeminiTestResult | { ok: true; text: string });

/** Диагностика подключения провайдеров — отдельно от основного потока опроса */
export function ApiTestPanel({ keys, onOpenSettings }: { keys: ApiKeys; onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState<null | Provider>(null);
  const [result, setResult] = useState<TestOutcome | null>(null);

  const run = async (provider: Provider) => {
    setLoading(provider);
    setResult(null);
    const r =
      provider === "gemini"
        ? await testGeminiImage(prompt, keys.gemini)
        : provider === "hf"
          ? await testHuggingFaceImage(prompt, keys.huggingface)
          : provider === "yandex-gpt"
            ? await testYandexGpt(prompt, keys.yandexApiKey, keys.yandexFolderId)
            : provider === "yandex-art"
              ? await testYandexArt(prompt, keys.yandexApiKey, keys.yandexFolderId)
              : await testPollinationsImage(prompt);
    setResult({ provider: PROVIDER_LABEL[provider], ...r });
    setLoading(null);
    if (r.ok) console.info(`[ApiTest:${provider}] ответ получен`, "bytesKb" in r ? `~${r.bytesKb} КБ` : "(текст)");
    else console.error(`[ApiTest:${provider}] ошибка:\n${r.error}`);
  };

  const hasAnyKey = Boolean(
    keys.gemini.trim() || keys.huggingface.trim() || (keys.yandexApiKey.trim() && keys.yandexFolderId.trim())
  );

  return (
    <div className="card-paper overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2.5">
          <span className={cx("grid h-9 w-9 place-items-center rounded-xl border-2 border-ink", hasAnyKey ? "bg-sea text-paper" : "bg-foam text-ink/50")}>
            <IconCamera className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block font-display text-[14px] font-bold leading-tight text-pine">Тест провайдеров картинок</span>
            <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-ink/45">
              Gemini · Yandex · Hugging Face · без ключа
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
            <div className="mb-3 rounded-xl border-2 border-ink/15 bg-foam p-3 text-[12.5px] font-bold leading-snug text-ink/65">
              Для Gemini, Yandex и Hugging Face нужны ключи из настроек, но{" "}
              <span className="text-moss">Pollinations работает вообще без ключа</span> — начните с него, чтобы убедиться, что генерация картинок жива.
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
            <ChunkyButton variant="dark" onClick={() => void run("gemini")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "gemini" ? "Рисует…" : "Gemini"}
            </ChunkyButton>
            <ChunkyButton variant="primary" onClick={() => void run("yandex-art")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "yandex-art" ? "Рисует…" : "Проверить YandexART"}
            </ChunkyButton>
            <ChunkyButton variant="coral" onClick={() => void run("hf")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "hf" ? "Рисует…" : "Hugging Face"}
            </ChunkyButton>
            <ChunkyButton variant="dark" onClick={() => void run("yandex-gpt")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "yandex-gpt" ? "Пишет…" : "Проверить YandexGPT"}
            </ChunkyButton>
            <ChunkyButton variant="ghost" onClick={() => void run("pollinations")} disabled={loading !== null} className="col-span-2 px-2 py-2.5 text-[12.5px]">
              {loading === "pollinations" ? "Рисует…" : "Без ключа (Pollinations)"}
            </ChunkyButton>
          </div>

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
                {result.provider}: подключение работает · ~{result.bytesKb.toLocaleString("ru-RU")} КБ
              </figcaption>
            </figure>
          )}

          {result && !loading && result.ok && "text" in result && (
            <div className="animate-pop mt-3 overflow-hidden rounded-xl border-[2.5px] border-fern">
              <p className="bg-fern px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-paper">
                {result.provider} отвечает — история из первых строк
              </p>
              <pre className="log-scroll max-h-44 overflow-auto whitespace-pre-wrap bg-paper p-3 font-body text-[12.5px] font-semibold leading-relaxed text-pine">
{result.text}
              </pre>
            </div>
          )}

          {result && !loading && !result.ok && (
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
