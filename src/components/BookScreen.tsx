import { useEffect, useRef } from "react";
import type { EngineKind, GeneratedBook, GeneratedPage } from "../types";
import { STAGE_META } from "../data/content";
import type { Palette } from "../data/content";
import { cx, ChunkyButton, Sticker } from "./ui";
import { IconAlert, IconBook, IconCheck, IconDownload, IconRefresh, IconSparkle, IconWand } from "./icons";

const ENGINE_LABEL: Record<EngineKind, string> = {
  demo: "демо-движок",
  gemini: "история: Gemini (запасной)",
  "gemini+claude": "Gemini + Claude",
};

const shortError = (e?: string) => (e ? (e.length > 54 ? `${e.slice(0, 54)}…` : e) : "");

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
      { threshold: 0.16 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function PageImage({ page }: { page: GeneratedPage }) {
  if (page.image.startsWith("<"))
    return <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: page.image }} />;
  return <img src={page.image} alt="" className="absolute inset-0 h-full w-full object-cover" />;
}

function SourceSticker({ page }: { page: GeneratedPage }) {
  if (page.imageSource === "demo")
    return (
      <span
        title={page.imageError}
        className="absolute left-3 top-3 z-10 -rotate-2 rounded-lg border-2 border-ink bg-coral px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-paper shadow-block-sm"
      >
        демо{page.imageError ? ` · ${shortError(page.imageError)}` : ""}
      </span>
    );
  if (page.imageSource === "huggingface")
    return (
      <span className="absolute left-3 top-3 z-10 -rotate-2 rounded-lg border-2 border-ink bg-berry px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-paper shadow-block-sm">
        Hugging Face
      </span>
    );
  if (page.imageSource === "pollinations")
    return (
      <span className="absolute left-3 top-3 z-10 -rotate-2 rounded-lg border-2 border-ink bg-moss px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-paper shadow-block-sm">
        Pollinations · без ключа
      </span>
    );
  if (page.imageSource === "gemini")
    return (
      <span className="absolute left-3 top-3 z-10 -rotate-2 rounded-lg border-2 border-ink bg-sea px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-paper shadow-block-sm">
        Gemini
      </span>
    );
  return null;
}

function BookPage({ page, book, palette, index }: { page: GeneratedPage; book: GeneratedBook; palette: Palette; index: number }) {
  const ref = useReveal<HTMLDivElement>();
  const [INK, , , , PAPER, WARM] = palette.colors;
  const tilt = index % 2 === 0 ? "md:-rotate-[0.6deg]" : "md:rotate-[0.6deg]";

  return (
    <figure ref={ref} className={cx("page-reveal mx-auto w-full max-w-[600px]", tilt)}>
      {page.kind === "spread" && page.spread && (
        <figcaption className="mb-2.5 flex items-center justify-between px-1">
          <Sticker color={STAGE_META[page.spread.stage].color}>{STAGE_META[page.spread.stage].label}</Sticker>
          <span className="font-display text-[12px] font-bold uppercase tracking-widest text-ink/45">
            разворот {page.spread.spread_number} / {book.input.spread_count}
          </span>
        </figcaption>
      )}
      <div className="overflow-hidden rounded-[20px] border-[3px] border-ink shadow-page">
        <div className="relative aspect-square bg-pine">
          <PageImage page={page} />
          <SourceSticker page={page} />
          {page.kind === "cover" && (
            <div className="absolute inset-x-5 top-5 rounded-2xl bg-pine/55 px-4 py-4 text-center backdrop-blur-[2px] sm:top-8 sm:px-8">
              <p className="font-display text-[24px] font-bold leading-tight text-paper drop-shadow-[2px_2px_0_rgba(23,53,43,0.85)] sm:text-[32px]">
                {book.story.title}
              </p>
              <p className="font-hand mt-1 text-[20px] leading-none text-marigold sm:text-[24px]">история для {book.input.child.name}</p>
            </div>
          )}
          {page.kind === "spread" && page.spread && (
            <div className="absolute inset-x-0 bottom-0 border-t-[3px] border-ink px-5 py-4 sm:px-7 sm:py-5" style={{ background: `${WARM}d9` }}>
              <p className="text-center text-[15px] font-extrabold leading-snug sm:text-[17px]" style={{ color: PAPER, textShadow: `1px 1.5px 0 ${INK}66` }}>
                {page.spread.text}
              </p>
            </div>
          )}
          {page.kind === "back" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-14 text-center">
              <IconSparkle className="h-7 w-7 text-marigold" />
              <p className="text-[15px] font-extrabold leading-snug text-paper sm:text-[17px]">{book.story.back_cover.blurb_text}</p>
              <p className="font-hand text-[26px] leading-none text-marigold">{book.input.child.name} — главный герой этой книги</p>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

export function BookScreen({
  book, palette, onDownload, exporting, onNewBook, onRegenerate, lastPdf,
}: {
  book: GeneratedBook;
  palette: Palette;
  onDownload: () => void;
  exporting: null | { done: number; total: number };
  onNewBook: () => void;
  onRegenerate: () => void;
  lastPdf: null | { name: string; kb: number; pages: number };
}) {
  const rep = book.imageReport;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="step-enter mb-8 text-center">
        <span className="inline-block -rotate-2 rounded-lg border-2 border-ink bg-fern px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-paper shadow-block-sm">
          книга готова · {book.pages.length} страниц · {ENGINE_LABEL[book.engine]}
        </span>
        <h1 className="mt-4 font-display text-[30px] font-bold leading-tight text-pine sm:text-[40px]">{book.story.title}</h1>
        <p className="font-hand mt-1 text-[24px] text-coral">листайте вниз — книга читается скроллом</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <ChunkyButton variant="coral" onClick={onDownload} disabled={!!exporting} className="px-7 py-3.5 text-[16px]">
            <IconDownload className="h-5 w-5" />
            {exporting ? `Собираем PDF… ${exporting.done}/${exporting.total}` : "Скачать PDF"}
          </ChunkyButton>
          <ChunkyButton variant="ghost" onClick={onRegenerate} disabled={!!exporting}>
            <IconRefresh className="h-5 w-5" /> Пересобрать
          </ChunkyButton>
          <ChunkyButton variant="ghost" onClick={onNewBook} disabled={!!exporting}>
            <IconBook className="h-5 w-5" /> Новая книга
          </ChunkyButton>
        </div>
        {lastPdf && (
          <p className="animate-pop mx-auto mt-4 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border-2 border-fern bg-fern/15 px-4 py-2 text-[13px] font-extrabold text-moss">
            <IconCheck className="h-4 w-4" strokeWidth={3} />
            {lastPdf.name} · {lastPdf.kb.toLocaleString("ru-RU")} КБ · {lastPdf.pages} стр. — файл реально сформирован из Blob
          </p>
        )}
        {rep && (
          <p className="mt-3 text-[12.5px] font-extrabold text-ink/55">
            иллюстрации: <span className="text-sea">Gemini {rep.gemini}</span> ·{" "}
            <span className={rep.hf ? "text-berry" : "text-ink/40"}>Hugging Face {rep.hf}</span> ·{" "}
            <span className={rep.pollinations ? "text-moss" : "text-ink/40"}>Pollinations {rep.pollinations}</span> ·{" "}
            <span className={rep.demo ? "text-coral" : "text-ink/40"}>демо {rep.demo}</span>
          </p>
        )}
        {rep && rep.demo > 0 && (
          <div className="animate-pop mx-auto mt-3 max-w-xl rounded-2xl border-[2.5px] border-coral bg-coral/12 p-4 text-left">
            <p className="flex items-center gap-2 font-display text-[12.5px] font-bold uppercase tracking-wider text-coral">
              <IconAlert className="h-4 w-4 shrink-0" />
              {rep.demo} из {book.pages.length} страниц — демо-иллюстрации
            </p>
            {rep.firstError && (
              <pre className="log-scroll mt-2 max-h-28 overflow-auto break-words whitespace-pre-wrap rounded-lg bg-paper/75 px-3 py-2 font-mono text-[11.5px] font-semibold leading-snug text-ink/75">
{rep.firstError}
              </pre>
            )}
            <p className="mt-2 text-[12.5px] font-bold leading-snug text-ink/60">
              Проверьте ключи: настройки → «Проверить ключ» или панель «Тест Gemini / Hugging Face». Если у ключа нулевая квота — включите биллинг в Google AI Studio или добавьте токен Hugging Face.
            </p>
          </div>
        )}
        {book.moderated.blocked > 0 && (
          <p className="mt-3 text-[12.5px] font-bold text-coral">Content Safety: {book.moderated.blocked} фрагм. смягчено после фильтра</p>
        )}
      </header>

      <div className="space-y-10 pb-6">
        {book.pages.map((p, i) => (
          <BookPage key={i} page={p} book={book} palette={palette} index={i} />
        ))}
      </div>

      <footer className="pb-14 pt-4 text-center">
        <p className="font-hand text-[26px] text-moss">конец — и начало новых историй</p>
        <div className="mt-3 flex justify-center">
          <ChunkyButton variant="dark" onClick={onDownload} disabled={!!exporting}>
            <IconWand className="h-5 w-5" /> {exporting ? "Собираем…" : "Скачать PDF"}
          </ChunkyButton>
        </div>
      </footer>
    </div>
  );
}
