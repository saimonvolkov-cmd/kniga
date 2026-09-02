import { useState } from "react";
import type { ApiKeys } from "../types";
import { ChunkyButton } from "./ui";
import { IconGear, IconX } from "./icons";

export function SettingsModal({
  open, keys, onSave, onClose,
}: {
  open: boolean;
  keys: ApiKeys;
  onSave: (k: ApiKeys) => void;
  onClose: () => void;
}) {
  const [gemini, setGemini] = useState(keys.gemini);
  const [anthropic, setAnthropic] = useState(keys.anthropic);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-pine/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card-paper animate-pop w-full max-w-lg p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
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

        <label className="mb-4 block">
          <span className="mb-1.5 block font-display text-sm font-bold text-pine">GEMINI_API_KEY <span className="font-body text-[11px] font-bold text-ink/45">— иллюстрации (Nano Banana)</span></span>
          <input
            type="password"
            value={gemini}
            onChange={(e) => setGemini(e.target.value)}
            placeholder="AIza…"
            className="field-input w-full px-4 py-2.5 font-mono text-sm font-bold text-pine"
          />
        </label>
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
          Эта сборка — чисто браузерная, ключи хранятся только в вашем localStorage и уходят напрямую в Gemini/Anthropic.
          В проде поставьте перед ними Node/Express-прокси (<code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">/api/generate-story</code>,{" "}
          <code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">/api/generate-image</code>,{" "}
          <code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">/api/moderate</code>), который читает ключи из{" "}
          <code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">.env</code> — код провайдера в{" "}
          <code className="rounded bg-pine px-1 py-0.5 font-mono text-[11px] text-foam">src/lib/api.ts</code> уже изолирован и переносится без изменений.
        </div>

        <div className="flex justify-end gap-3">
          <ChunkyButton variant="ghost" onClick={onClose}>Закрыть</ChunkyButton>
          <ChunkyButton
            onClick={() => {
              onSave({ gemini: gemini.trim(), anthropic: anthropic.trim() });
              onClose();
            }}
          >
            Сохранить
          </ChunkyButton>
        </div>
      </div>
    </div>
  );
}
