import { useEffect, useState } from "react";
import type { ApiKeys } from "../types";
import { checkGeminiKey, checkHuggingFaceKey, detectConnection, hfTokenFormatHint } from "../lib/api";
import { ChunkyButton, cx } from "./ui";
import { IconGear, IconX } from "./icons";

export function SettingsModal({
  open, keys, onSave, onClose, onToast,
}: {
  open: boolean;
  keys: ApiKeys;
  onSave: (k: ApiKeys) => void;
  onClose: () => void;
  onToast?: (kind: "ok" | "warn" | "err", text: string) => void;
}) {
  const [gemini, setGemini] = useState(keys.gemini);
  const [anthropic, setAnthropic] = useState(keys.anthropic);
  const [hf, setHf] = useState(keys.huggingface);
  const [checking, setChecking] = useState<null | "gemini" | "hf">(null);
  const [checkGemini, setCheckGemini] = useState<{ ok: boolean; detail: string } | null>(null);
  const [checkHf, setCheckHf] = useState<{ ok: boolean; detail: string } | null>(null);
  const [yandexOn, setYandexOn] = useState(false);

  useEffect(() => {
    if (open) void detectConnection(true).then((m) => setYandexOn(m === "backend" || m === "cloud"));
  }, [open]);

  const hfFormatHint = hfTokenFormatHint(hf);

  const runCheck = async (which: "gemini" | "hf") => {
    setChecking(which);
    if (which === "gemini") setCheckGemini(null);
    else setCheckHf(null);
    const r = which === "gemini" ? await checkGeminiKey(gemini.trim()) : await checkHuggingFaceKey(hf.trim());
    if (which === "gemini") setCheckGemini(r);
    else setCheckHf(r);
    setChecking(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-pine/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card-paper animate-pop max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 sm:p-7" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-[20px] font-bold text-pine">
              <IconGear className="h-5 w-5" /> API-ключи
            </h3>
            <p className="mt-1 text-[13px] font-semibold text-ink/60">
              Без ключей пайплайн работает на локальном демо-движке: истории, иллюстрации и PDF — всё настоящее, только нарисовано процедурно.
            </p>
          </div>
          <button onClick={onClose} className="btn-press grid h-9 w-9 shrink-0 place-items-center rounded-xl border-[2.5px] border-ink bg-paper shadow-block-sm" aria-label="Закрыть">
            <IconX className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border-[2.5px] border-marigold/70 bg-marigold/10 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-pine">Yandex Cloud <span className="font-body text-[11px] font-bold text-ink/45">— история (YandexGPT) + иллюстрации (YandexART)</span></span>
            <span className={cx(
              "flex items-center gap-1.5 rounded-lg border-2 border-ink px-2 py-0.5 font-display text-[10.5px] font-bold",
              yandexOn ? "bg-fern text-paper" : "bg-paper text-ink/50"
            )}>
              <i className={cx("h-2 w-2 rounded-full", yandexOn ? "animate-pulse-dot bg-marigold" : "bg-ink/30")} />
              {yandexOn ? "настроен на сервере" : "не настроен"}
            </span>
          </div>
          <p className="mt-2 text-[11.5px] font-bold leading-snug text-ink/60">
            Ключи Yandex в браузере не вводятся: Yandex API не отдаёт CORS, поэтому запросы идут через сервер —
            <b> Yandex Cloud Functions</b> (URL задаются переменными <code className="rounded bg-pine px-1 py-0.5 font-mono text-[10.5px] text-foam">VITE_YANDEX_*_FN_URL</code>,
            ключи — в переменных окружения функций, см. <code className="rounded bg-pine px-1 py-0.5 font-mono text-[10.5px] text-foam">yandex-functions/</code>)
            или <b>локальный прокси</b> (<code className="rounded bg-pine px-1 py-0.5 font-mono text-[10.5px] text-foam">npm --prefix server run server</code>, ключи из серверного .env).
          </p>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-pine">GEMINI_API_KEY <span className="font-body text-[11px] font-bold text-ink/45">— иллюстрации (Nano Banana) и история (запасной)</span></span>
            <button
              type="button"
              onClick={() => void runCheck("gemini")}
              disabled={checking !== null || !gemini.trim()}
              className="btn-press shrink-0 rounded-lg border-2 border-ink bg-sea px-2.5 py-1 font-display text-[11px] font-bold text-paper shadow-block-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking === "gemini" ? "Проверяю…" : "Проверить ключ"}
            </button>
          </div>
          <input
            type="password"
            value={gemini}
            onChange={(e) => { setGemini(e.target.value); setCheckGemini(null); }}
            placeholder="AIza…"
            className="field-input w-full px-4 py-2.5 font-mono text-sm font-bold text-pine"
          />
          {checkGemini && (
            <p className={cx("animate-pop mt-2 break-words rounded-lg border-2 px-2.5 py-1.5 text-[12px] font-bold leading-snug", checkGemini.ok ? "border-fern bg-fern/10 text-moss" : "border-coral bg-coral/10 text-coral")}>
              {checkGemini.detail}
            </p>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-pine">HUGGINGFACE_API_KEY <span className="font-body text-[11px] font-bold text-ink/45">— иллюстрации (запасной провайдер, fal-ai)</span></span>
            <button
              type="button"
              onClick={() => void runCheck("hf")}
              disabled={checking !== null || !hf.trim()}
              className="btn-press shrink-0 rounded-lg border-2 border-ink bg-berry px-2.5 py-1 font-display text-[11px] font-bold text-paper shadow-block-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking === "hf" ? "Проверяю…" : "Проверить"}
            </button>
          </div>
          <input
            type="password"
            value={hf}
            onChange={(e) => { setHf(e.target.value); setCheckHf(null); }}
            placeholder="hf_…"
            className="field-input w-full px-4 py-2.5 font-mono text-sm font-bold text-pine"
          />
          {hfFormatHint && (
            <p className="animate-pop mt-2 break-words rounded-lg border-2 border-marigold bg-marigold/15 px-2.5 py-1.5 text-[12px] font-bold leading-snug text-pine">
              {hfFormatHint}
            </p>
          )}
          {checkHf && (
            <p className={cx("animate-pop mt-2 break-words rounded-lg border-2 px-2.5 py-1.5 text-[12px] font-bold leading-snug", checkHf.ok ? "border-fern bg-fern/10 text-moss" : "border-coral bg-coral/10 text-coral")}>
              {checkHf.detail}
            </p>
          )}
        </div>

        <label className="mb-5 block">
          <span className="mb-1.5 block font-display text-sm font-bold text-pine">ANTHROPIC_API_KEY <span className="font-body text-[11px] font-bold text-ink/45">— история (Sonnet) и модерация (Haiku)</span></span>
          <input
            type="password"
            value={anthropic}
            onChange={(e) => setAnthropic(e.target.value)}
            placeholder="sk-ant-…"
            className="field-input w-full px-4 py-2.5 font-mono text-sm font-bold text-pine"
          />
        </label>

        <div className="mb-5 rounded-xl border-2 border-ink/15 bg-foam p-3.5 text-[12px] font-semibold leading-relaxed text-ink/65">
          Порядок провайдеров иллюстраций: <b>YandexART (через прокси) → Gemini → Hugging Face → Pollinations (без ключа) → демо</b>.
          История: <b>YandexGPT (через прокси) → Claude → Gemini → демо</b>. Ключи хранятся только в вашем localStorage.
          В проде поставьте Node/Express-прокси, который читает ключи из <code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">.env</code> — код в{" "}
          <code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">src/lib/api.ts</code> переносится без изменений.
        </div>

        <div className="flex justify-end gap-3">
          <ChunkyButton variant="ghost" onClick={onClose}>Закрыть</ChunkyButton>
          <ChunkyButton
            onClick={() => {
              const k: ApiKeys = { ...keys, gemini: gemini.trim(), anthropic: anthropic.trim(), huggingface: hf.trim() };
              onSave(k);
              onClose();
              if (k.gemini)
                void checkGeminiKey(k.gemini).then((r) => onToast?.(r.ok ? "ok" : "err", r.ok ? `Gemini: ${r.detail}` : `Gemini не принимает ключ — ${r.detail}`));
              if (k.huggingface)
                void checkHuggingFaceKey(k.huggingface).then((r) => onToast?.(r.ok ? "ok" : "err", r.ok ? `Hugging Face: ${r.detail}` : `Hugging Face не принимает токен — ${r.detail}`));
            }}
          >
            Сохранить
          </ChunkyButton>
        </div>
      </div>
    </div>
  );
}
