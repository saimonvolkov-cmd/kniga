import { useState } from "react";
import {
  detectConnection, testPollinationsImage, testYandexArt, testYandexGpt,
  type ConnMode, type GeminiTestResult,
} from "../lib/api";
import { ChunkyButton, cx } from "./ui";
import { IconCamera } from "./icons";

const DEFAULT_PROMPT = "нарисуй лису в детской книжной иллюстрации";

type Provider = "yandex-gpt" | "yandex-art" | "pollinations";
const LABEL: Record<Provider, string> = {
  "yandex-gpt": "YandexGPT",
  "yandex-art": "YandexART",
  pollinations: "Pollinations",
};

type TestOutcome = { provider: string } & (GeminiTestResult | { ok: true; text: string });

const CONN_META: Record<ConnMode, { text: string; chip: string; dot: string }> = {
  backend: {
    text: "Yandex настроен на сервере · ключ в серверном .env",
    chip: "border-fern bg-fern/10 text-moss",
    dot: "bg-fern",
  },
  off: {
    text: "Yandex не настроен · запусти npm --prefix server run server",
    chip: "border-coral bg-coral/10 text-coral",
    dot: "bg-coral",
  },
};

/** Диагностика генерации — отдельно от основного потока опроса */
export function ApiTestPanel() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState<null | Provider>(null);
  const [result, setResult] = useState<TestOutcome | null>(null);
  const [conn, setConn] = useState<ConnMode | null>(null);

  /** всегда спрашиваем прокси заново — кэш не должен врать */
  const probe = () => {
    void detectConnection(true).then(setConn);
  };

  const run = async (provider: Provider) => {
    setLoading(provider);
    setResult(null);
    const mode = await detectConnection(true);
    setConn(mode);
    const r =
      provider === "yandex-gpt"
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
        onClick={() => {
          setOpen((v) => !v);
          probe();
        }}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-ink bg-marigold text-pine">
            <IconCamera className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block font-display text-[14px] font-bold leading-tight text-pine">Тест генерации</span>
            <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-ink/45">
              YandexGPT · YandexART · Pollinations
            </span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={cx("h-4 w-4 shrink-0 text-ink/50 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="animate-rise border-t-2 border-dashed border-ink/15 p-4">
          <p className={cx("mb-3 flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-[11.5px] font-extrabold leading-snug", conn ? CONN_META[conn].chip : "border-ink/15 bg-foam text-ink/50")}>
            <i className={cx("h-2.5 w-2.5 shrink-0 rounded-full", conn ? cx(CONN_META[conn].dot, "animate-pulse-dot") : "bg-ink/30")} />
            {conn ? CONN_META[conn].text : "определяю канал…"}
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block font-display text-[12px] font-bold uppercase tracking-wider text-ink/50">Промпт</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="field-input w-full resize-none px-3 py-2 text-[13.5px] font-bold text-pine" />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <ChunkyButton variant="dark" onClick={() => void run("yandex-gpt")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "yandex-gpt" ? "Пишет…" : "Проверить YandexGPT"}
            </ChunkyButton>
            <ChunkyButton variant="primary" onClick={() => void run("yandex-art")} disabled={loading !== null} className="px-2 py-2.5 text-[12.5px]">
              {loading === "yandex-art" ? "Рисует…" : "Проверить YandexART"}
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
