import { useMemo } from "react";
import type { BookInput, SurveyDraft } from "../types";
import { GENRES, getPalette } from "../data/content";
import { pickCompanionKind, renderCoverScene } from "../lib/illustrator";
import { IconSparkle, IconStar } from "./icons";

/** Живая обложка: перерисовывается при каждом изменении опроса */
export function CoverPreview({ draft, seed }: { draft: SurveyDraft; seed: number }) {
  const palette = getPalette(draft.paletteId);
  const name = draft.name.trim() || "Малыш";
  const genreLabel = GENRES.find((g) => g.value === draft.genre)?.label ?? "Сказка";

  const svg = useMemo(() => {
    const pseudo: BookInput = {
      child: { name, age_group: draft.ageGroup ?? "4-5", gender: draft.gender ?? "female" },
      companion: { name: null, type: null, role: null },
      genre: draft.genre ?? "fairy_tale",
      story_theme: "surprise_me",
      spread_count: 12,
      personal_details: { favorite_place: null, favorite_activity: null },
      palette_id: palette.id,
    };
    const kind =
      draft.hasCompanion && draft.companionName.trim() ? pickCompanionKind(pseudo, seed) : null;
    return renderCoverScene(pseudo, palette, seed, kind);
  }, [draft.genre, draft.gender, draft.hasCompanion, draft.companionName, draft.ageGroup, palette, seed, name]);

  return (
    <div className="relative mx-auto w-full max-w-[330px]" style={{ ["--tilt" as string]: "-3deg" }}>
      <IconSparkle className="animate-float-slow absolute -left-7 top-8 h-7 w-7 text-marigold" />
      <IconStar className="animate-drift absolute -right-5 top-1/3 h-6 w-6 text-coral" />
      <IconSparkle className="animate-float absolute -bottom-4 left-8 h-5 w-5 text-sea" />

      <div className="animate-float overflow-hidden rounded-[22px] border-[3px] border-ink shadow-page">
        <div className="relative aspect-square">
          <div
            className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          {/* заголовок-дизайнэлемент */}
          <div className="absolute inset-x-4 top-4 rounded-2xl bg-pine/55 px-3 py-3 text-center backdrop-blur-[2px]">
            <p className="font-display text-[21px] font-bold leading-tight text-paper drop-shadow-[2px_2px_0_rgba(23,53,43,0.8)]">
              Сказка про {name}
            </p>
            <p className="font-hand mt-0.5 text-[19px] leading-none text-marigold">
              {genreLabel.toLowerCase()} · {palette.name.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t-[3px] border-ink bg-paper px-3.5 py-2">
          <span className="font-display text-[11px] font-bold uppercase tracking-widest text-ink/60">живой предпросмотр</span>
          <span className="flex gap-1.5">
            {palette.colors.slice(1).map((c) => (
              <i key={c} className="h-3.5 w-3.5 rounded-full border-[1.5px] border-ink/70" style={{ background: c }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
