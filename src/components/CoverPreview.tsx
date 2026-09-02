import { useMemo } from "react";
import type { SurveyDraft } from "../types";
import { getPalette } from "../data/content";
import { renderCoverScene, pickCompanionKind } from "../lib/illustrator";
import { draftToInput } from "./steps";
import type { CompanionKind } from "../types";

/** Живая обложка в сайдбаре: перерисовывается при каждом изменении опроса */
export function CoverPreview({ draft, seed }: { draft: SurveyDraft; seed: number }) {
  const svg = useMemo(() => {
    const input = draftToInput(draft) ?? {
      child: { name: draft.name.trim() || "Герой", age_group: "4-5" as const, gender: (draft.gender ?? "female") as "male" | "female" },
      companion: { name: null, type: null, role: null },
      genre: draft.genre ?? "fairy_tale",
      story_theme: draft.theme ?? "surprise_me",
      spread_count: 12 as const,
      personal_details: { favorite_place: null, favorite_activity: null },
      palette_id: draft.paletteId ?? "pine",
    };
    const kind: CompanionKind | null =
      draft.hasCompanion && draft.companionName.trim()
        ? pickCompanionKind({ ...input, companion: { name: draft.companionName.trim(), type: draft.companionType, role: draft.companionRole } }, seed)
        : null;
    return renderCoverScene(input, getPalette(draft.paletteId), seed, kind);
  }, [draft, seed]);

  const palette = getPalette(draft.paletteId);
  const name = draft.name.trim();

  return (
    <div className="animate-pop">
      <div className="relative overflow-hidden rounded-2xl border-[3px] border-ink shadow-page transition-transform duration-300 hover:-rotate-1">
        <div className="aspect-[4/5] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-pine/70 to-transparent px-4 pb-8 pt-4 text-center">
          <p className="font-display text-[19px] font-bold leading-tight text-paper drop-shadow-[2px_2px_0_rgba(23,53,43,0.9)]">
            {name ? `Сказка про ${name}` : "Сказка про…"}
          </p>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl border-2 border-ink bg-paper/95 px-3 py-1.5">
          <span className="flex -space-x-1.5">
            {palette.colors.map((c) => (
              <i key={c} className="h-4 w-4 rounded-full border-2 border-ink" style={{ background: c }} />
            ))}
          </span>
          <span className="font-display text-[10px] font-bold uppercase tracking-wider text-ink/60">живое превью</span>
        </div>
      </div>
      <p className="font-hand mt-3 text-center text-[22px] leading-none text-sea">
        обложка меняется, пока вы отвечаете
      </p>
    </div>
  );
}
