import { useEffect, useRef } from "react";
import type { GeneratedPage, PipelineStepState } from "../types";
import type { Palette } from "../data/content";
import { cx, ChunkyButton } from "./ui";
import { IconAlert, IconCheck, IconX } from "./icons";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            el.classList.add("is-visible");
            io.disconnect();
          }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function StatusDot({ status }: { status: PipelineStepState["status"] }) {
  if (status === "done")
    return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-fern text-paper"><IconCheck className="h-3.5 w-3.5" strokeWidth={3.2} /></span>;
  if (status === "warn")
    return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-marigold text-pine"><IconAlert className="h-3.5 w-3.5" strokeWidth={2.6} /></span>;
  if (status === "active")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center gap-[3px] rounded-full border-2 border-ink bg-paper">
        {[0, 1, 2].map((i) => (
          <i key={i} className="animate-dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    );
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-ink/25 bg-foam" />;
}

export function ProgressScreen({
  steps, log, latest, palette, onCancel, title, apiError,
}: {
  steps: PipelineStepState[];
  log: string[];
  latest: GeneratedPage | null;
  palette: Palette;
  onCancel: () => void;
  title: string;
  apiError?: string | null;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const doneCount = steps.filter((s) => s.status === "done").length;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_300px]">
      <section className="card-paper step-enter p-6 sm:p-8">
        <span className="inline-block rotate-1 rounded-lg border-2 border-ink bg-marigold px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-pine shadow-block-sm">
          печатаем книгу
        </span>
        <h2 className="mt-3 font-display text-[26px] font-bold leading-tight text-pine">{title}</h2>
        <p className="mt-1.5 text-sm font-semibold text-ink/60">Пайплайн из семи модулей идёт по порядку — каждый шаг пишет в журнал.</p>

        {apiError && (
          <div className="animate-pop mt-4 rounded-xl border-[2.5px] border-coral bg-coral/12 p-3.5">
            <p className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-wider text-coral">
              <IconAlert className="h-4 w-4 shrink-0" /> API-иллюстратор отклонил запрос — страницы идут демо-движком
            </p>
            <pre className="log-scroll mt-2 max-h-24 overflow-auto break-words whitespace-pre-wrap rounded-lg bg-paper/75 px-2.5 py-1.5 font-mono text-[11px] font-semibold leading-snug text-ink/75">
{apiError}
            </pre>
          </div>
        )}

        <ol className="mt-6 grid gap-2.5">
          {steps.map((s) => (
            <li
              key={s.id}
              className={cx(
                "flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-colors",
                s.status === "active" ? "border-ink bg-foam shadow-block-sm" : "border-transparent",
                s.status === "warn" && "border-marigold bg-marigold/10"
              )}
            >
              <StatusDot status={s.status} />
              <span className="min-w-0 flex-1">
                <span className={cx("block font-display text-[13.5px] font-bold leading-tight", s.status === "pending" ? "text-ink/40" : "text-pine")}>
                  {s.label}
                </span>
                {s.detail && <span className="block truncate text-[11.5px] font-bold text-ink/50">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 h-3 overflow-hidden rounded-full border-2 border-ink bg-foam">
          <div
            className="h-full rounded-full bg-fern transition-all duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-5">
          <p className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-ink/45">журнал пайплайна</p>
          <div ref={logRef} className="log-scroll max-h-40 overflow-y-auto rounded-xl border-[2.5px] border-ink bg-pine p-3">
            {log.length === 0 && <p className="font-mono text-[11.5px] font-semibold text-foam/50">заводим печатный станок…</p>}
            {log.map((l, i) => (
              <p key={i} className="font-mono text-[11.5px] font-semibold leading-relaxed text-foam/90">
                <span className="text-marigold">›</span> {l}
              </p>
            ))}
            <span className="animate-blink font-mono text-[11.5px] text-marigold">▌</span>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <ChunkyButton variant="ghost" onClick={onCancel}>
            <IconX className="h-4 w-4" /> Отменить
          </ChunkyButton>
        </div>
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card-paper overflow-hidden">
          <p className="border-b-[2.5px] border-ink bg-foam px-4 py-2.5 font-display text-[12px] font-bold uppercase tracking-wider text-ink/60">
            последняя страница
          </p>
          {latest ? (
            <div key={latest.image.length} className="animate-pop relative aspect-square">
              {latest.image.startsWith("<") ? (
                <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: latest.image }} />
              ) : (
                <img src={latest.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {latest.imageSource === "demo" && (
                <span className="absolute left-2.5 top-2.5 -rotate-2 rounded-lg border-2 border-ink bg-coral px-2 py-0.5 text-[10px] font-extrabold uppercase text-paper shadow-block-sm">
                  демо
                </span>
              )}
              {latest.imageSource === "yandex-art" && (
                <span className="absolute left-2.5 top-2.5 -rotate-2 rounded-lg border-2 border-ink bg-marigold px-2 py-0.5 text-[10px] font-extrabold uppercase text-pine shadow-block-sm">
                  YandexART
                </span>
              )}
            </div>
          ) : (
            <div className="skeleton-shimmer aspect-square" />
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-dashed border-ink/25 px-3.5 py-3">
          <span className="flex -space-x-1.5">
            {palette.colors.slice(0, 5).map((c) => (
              <i key={c} className="h-4 w-4 rounded-full border-[1.5px] border-ink" style={{ background: c }} />
            ))}
          </span>
          <p className="text-[11.5px] font-bold leading-snug text-ink/55">иллюстрации красятся в выбранную палитру</p>
        </div>
      </aside>
    </div>
  );
}
