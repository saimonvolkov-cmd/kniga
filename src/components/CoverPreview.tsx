import { useMemo } from "react";
import type { SurveyDraft } from "../types";
import { getPalette } from "../data/content";
import { renderCoverScene, pickCompanionKind } from "../lib/illustrator";
import { GENRES } from "../data/content";
import { IconBook } from "./icons";

/** Живая обложка: перерисовывается при каждом выборе. Важно: контейнер имеет
    фиксированный aspect-square, поэтому смена сцены НЕ меняет высоту колонки
    и контент ниже не «прыгает» при каждом ответе. */
export function CoverPreview({ draft, seed }: { draft: SurveyDraft; seed: number }) {
  const palette = getPalette(draft.paletteId);
  const ready = Boolean(draft.genre && draft.gender);

  const svg = useMemo(() => {
    if (!ready) return null;
    const input = {
      child: { name: draft.name.trim() || "Герой", age_group: draft.ageGroup ?? "4-5", gender: draft.gender! },
      companion: { name: draft.companionName.trim() || null, type: draft.companionType, role: draft.companionRole },
      genre: draft.genre!,
      story_theme: draft.theme ?? "surprise_me",
      spread_count: draft.spreadCount ?? 12,
      personal_details: { favorite_place: null, favorite_activity: null },
      palette_id: draft.paletteId,
    };
    const kind = pickCompanionKind(input, seed);
    return renderCoverScene(input, palette, seed, kind);
  }, [draft.genre, draft.gender, draft.name, draft.ageGroup, draft.companionName, draft.companionType, draft.companionRole, draft.paletteId, draft.spreadCount, draft.theme, palette, seed, ready]);

  return (
    <div className="card-paper overflow-hidden">
      <div className="flex items-center justify-between border-b-[2.5px] border-ink bg-foam px-4 py-2.5">
        <span className="font-display text-[12px] font-bold uppercase tracking-wider text-ink/60">обложка · живое превью</span>
        <span className="flex -space-x-1.5">
          {palette.colors.slice(0, 5).map((c) => (
            <i key={c} className="h-4 w-4 rounded-full border-[1.5px] border-ink" style={{ background: c }} />
          ))}
        </span>
      </div>
      <div className="relative aspect-square">
        {svg ? (
          <div key={draft.genre + draft.paletteId} className="animate-rise absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-pine px-8 text-center">
            <IconBook className="h-12 w-12 text-marigold" />
            <p className="font-display text-[16px] font-bold leading-snug text-paper">Здесь появится обложка вашей книги</p>
            <p className="text-[12.5px] font-semibold leading-snug text-paper/60">
              выберите жанр и героя — превью оживёт{draft.genre ? ", осталось выбрать пол" : ""}
            </p>
          </div>
        )}
        {ready && (
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl bg-pine/55 px-3 py-2.5 text-center backdrop-blur-[2px]">
            <p className="font-display text-[15px] font-bold leading-tight text-paper drop-shadow-[1.5px_1.5px_0_rgba(23,53,43,0.85)]">
              {draft.name.trim() ? `Сказка про ${draft.name.trim()}` : "Сказка про меня"}
            </p>
            <p className="font-hand text-[16px] leading-tight text-marigold">
              {GENRES.find((g) => g.value === draft.genre)?.label.toLowerCase()} · {palette.name.toLowerCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
