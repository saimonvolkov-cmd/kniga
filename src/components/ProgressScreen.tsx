import type { GeneratedPage, PipelineStepState } from "../types";
import type { Palette } from "../data/content";
import { cx, ChunkyButton } from "./ui";
import { IconAlert, IconCheck } from "./icons";

function PageThumb({ page, palette }: { page: GeneratedPage | null; palette: Palette }) {
  if (!page)
    return (
      <div className="skeleton-shimmer grid aspect-square w-full place-items-center rounded-2xl border-[2.5px] border-ink">
        <span className="font-hand text-2xl text-ink/50">рисуем…</span>
      </div>
    );
  return (
    <div className="animate-pop relative overflow-hidden rounded-2xl border-[2.5px] border-ink shadow-block-sm">
      {page.image.startsWith("<") ? (
        <div className="aspect-square [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: page.image }} />
      ) : (
        <img src={page.image} alt="" className="aspect-square w-full object-cover" />
      )}
      {page.imageSource === "demo" && (
        <span className="absolute right-2 top-2 -rotate-2 rounded-md border-2 border-ink bg-coral px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-paper shadow-block-sm">
          демо
        </span>
      )}
      {page.imageSource === "huggingface" && (
        <span className="absolute right-2 top-2 -rotate-2 rounded-md border-2 border-ink bg-berry px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-paper shadow-block-sm">
          HF
        </span>
      )}
      <div className="border-t-[2.5px] border-ink px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-ink/60" style={{ background: palette.colors[4] }}>
        {page.kind === "cover" ? "передняя обложка" : page.kind === "back" ? "задняя обложка" : `разворот ${page.spread?.spread_number}`}
      </div>
    </div>
  );
}

export function ProgressScreen({
  steps, log, latest, palette, onCancel, title, geminiError,
}: {
  steps: PipelineStepState[];
  log: string[];
  latest: GeneratedPage | null;
  palette: Palette;
  onCancel: () => void;
  title: string;
  geminiError?: string | null;
}) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_300px]">
      <section className="card-paper step-enter p-6 sm:p-8">
        <span className="inline-block rotate-1 rounded-lg border-2 border-ink bg-marigold px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-pine shadow-block-sm">
          печатаем книгу
        </span>
        <h2 className="mt-3 font-display text-[26px] font-bold leading-tight text-pine">{title}</h2>
        <p className="mt-1.5 text-sm font-semibold text-ink/60">Пайплайн из восьми модулей идёт по порядку — каждый шаг пишет в журнал.</p>

        {geminiError && (
          <div className="animate-pop mt-4 rounded-xl border-[2.5px] border-coral bg-coral/12 p-3.5">
            <p className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-wider text-coral">
              <IconAlert className="h-4 w-4 shrink-0" /> API-иллюстрации недоступны — страницы идут демо-движком
            </p>
            <pre className="log-scroll mt-1.5 max-h-32 overflow-auto break-words whitespace-pre-wrap rounded-lg bg-paper/75 px-2.5 py-1.5 font-mono text-[11px] font-semibold leading-snug text-ink/75">
{geminiError}
            </pre>
            <p className="mt-1.5 text-[11.5px] font-bold leading-snug text-ink/55">
              Пайплайн уже прошёл каскад Gemini → YandexART → Hugging Face → бесплатный Pollinations (см. строки выше). Проверить каждый провайдер по отдельности можно в панели «Тест провайдеров картинок» — там же есть кнопки «Проверить YandexART/YandexGPT» и «Без ключа».
            </p>
          </div>
        )}

        <ol className="mt-6 space-y-2.5">
          {steps.map((s) => (
            <li
              key={s.id}
              className={cx(
                "flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-colors",
                s.status === "active" ? "border-ink bg-marigold/30" : "border-ink/12",
                s.status === "done" && "border-ink/12 bg-foam",
                s.status === "warn" && "border-ink bg-coral/15"
              )}
            >
              <span
                className={cx(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink",
                  s.status === "done" && "bg-fern text-paper",
                  s.status === "active" && "bg-paper",
                  s.status === "warn" && "bg-coral text-paper",
                  s.status === "pending" && "border-ink/30 text-ink/30"
                )}
              >
                {s.status === "done" ? (
                  <IconCheck className="h-4.5 w-4.5" strokeWidth={3} />
                ) : s.status === "warn" ? (
                  <IconAlert className="h-4 w-4" />
                ) : s.status === "active" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-[3px] border-pine/25 border-t-pine" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block font-display text-[14.5px] font-bold", s.status === "pending" ? "text-ink/40" : "text-pine")}>{s.label}</span>
                {s.detail && <span className="block truncate text-[12px] font-bold text-ink/55">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="font-display text-[13px] font-bold text-ink/55">готово {doneCount} из {steps.length}</span>
          <ChunkyButton variant="ghost" onClick={onCancel} className="px-4 py-2 text-[13px]">Отменить</ChunkyButton>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <PageThumb page={latest} palette={palette} />
        <div className="card-paper min-h-0 flex-1 overflow-hidden p-4">
          <p className="mb-2 font-display text-[12px] font-bold uppercase tracking-widest text-ink/50">журнал пайплайна</p>
          <div className="log-scroll max-h-56 overflow-auto rounded-lg bg-pine p-3 font-mono text-[11.5px] font-semibold leading-relaxed text-foam">
            {log.map((l, i) => (
              <p key={i} className={cx(i === log.length - 1 && "text-marigold")}>
                <span className="text-foam/40">›</span> {l}
              </p>
            ))}
            <span className="animate-blink text-marigold">▌</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
