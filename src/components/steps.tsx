import { useRef, useState } from "react";
import type { BookInput, SurveyDraft } from "../types";
import { AGE_GROUPS, COMPANION_ROLES, COMPANION_TYPES, GENRES, PALETTES, SPREAD_COUNTS, THEMES } from "../data/content";
import { downscaleImage } from "../lib/utils";
import { cx, ChunkyButton, OptionCard, SectionHead } from "./ui";
import {
  COMPANION_ROLE_ICONS, COMPANION_TYPE_ICONS, GENRE_ICONS,
  IconCamera, IconDice, IconHeart, IconMoon, IconSprout, IconTeddy, IconUpload, IconUsers, IconX,
} from "./icons";

export interface StepProps {
  draft: SurveyDraft;
  patch: (p: Partial<SurveyDraft>) => void;
  toast: (kind: "ok" | "warn" | "err", text: string) => void;
}

/** сборка Input JSON из черновика */
export function draftToInput(d: SurveyDraft): BookInput | null {
  if (!d.name.trim() || !d.ageGroup || !d.gender || !d.genre || !d.spreadCount || !d.theme || !d.paletteId) return null;
  return {
    child: { name: d.name.trim(), age_group: d.ageGroup, gender: d.gender },
    companion: d.hasCompanion && d.companionName.trim()
      ? { name: d.companionName.trim(), type: d.companionType, role: d.companionRole }
      : { name: null, type: null, role: null },
    genre: d.genre,
    story_theme: d.theme,
    spread_count: d.spreadCount,
    personal_details: {
      favorite_place: d.favoritePlace.trim() || null,
      favorite_activity: d.favoriteActivity.trim() || null,
    },
    palette_id: d.paletteId,
  };
}

export const emptyDraft = (): SurveyDraft => ({
  childPhotos: [], companionPhotos: [], name: "", ageGroup: null, gender: null, genre: null,
  spreadCount: null, theme: null, hasCompanion: true, companionName: "", companionType: "pet",
  companionRole: null, paletteId: "pine", favoritePlace: "", favoriteActivity: "",
});

function PhotoDrop({
  title, note, max, photos, onChange, toast, accent,
}: {
  title: string; note: string; max: number; photos: string[];
  onChange: (v: string[]) => void; toast: StepProps["toast"]; accent: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = max - photos.length;
    const list = Array.from(files).slice(0, room);
    if (list.length < files.length) toast("warn", `Максимум ${max} фото в этом блоке`);
    try {
      const added = await Promise.all(list.map((f) => downscaleImage(f, 900)));
      onChange([...photos, ...added]);
      if (added.length) toast("ok", `Фото добавлено: ${added.length}`);
    } catch {
      toast("err", "Не удалось прочитать файл — нужен JPG или PNG");
    }
  };

  return (
    <div className="rounded-2xl border-[2.5px] border-ink bg-foam p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-[15px] font-bold text-pine">{title}</p>
          <p className="text-xs font-semibold text-ink/60">{note}</p>
        </div>
        <span className="rounded-lg border-2 border-ink px-2 py-0.5 font-display text-xs font-bold" style={{ background: accent }}>
          {photos.length}/{max}
        </span>
      </div>
      <div
        className={cx("dashed-drop rounded-xl p-3", drag && "is-drag")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
      >
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border-2 border-ink">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-coral text-paper opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Удалить фото"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < max && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-ink/40 text-ink/55 transition-colors hover:border-coral hover:text-coral"
            >
              <IconUpload className="h-6 w-6" />
              <span className="text-[11px] font-extrabold">загрузить</span>
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={max > 1}
          className="hidden"
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
        />
        <p className="mt-2 text-center text-[11px] font-semibold text-ink/45">перетащите файлы сюда или нажмите «загрузить»</p>
      </div>
    </div>
  );
}

export function PhotoStep({ draft, patch, toast }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 1 · референсы" title="Кто будет в книге?" subtitle="Загрузите фото ребёнка — иллюстратор сохранит образ. Фото питомца или игрушки — по желанию." />
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoDrop title="Фото ребёнка" note="1–3 портрета, анфас или профиль" max={3} photos={draft.childPhotos} onChange={(v) => patch({ childPhotos: v })} toast={toast} accent="#f2b33d" />
        <PhotoDrop title="Питомец или игрушка" note="необязательно — попадёт на страницы" max={2} photos={draft.companionPhotos} onChange={(v) => patch({ companionPhotos: v })} toast={toast} accent="#3f8f8a" />
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border-2 border-ink/15 bg-foam p-3.5">
        <IconCamera className="mt-0.5 h-5 w-5 shrink-0 text-sea" />
        <p className="text-[13px] font-semibold leading-snug text-ink/70">
          Фото никуда не отправляются без вашего разрешения: в демо-режиме они остаются в браузере,
          при подключённом Gemini — уходят только как референс для иллюстраций.
        </p>
      </div>
    </div>
  );
}

export function ChildStep({ draft, patch }: StepProps) {
  const nameOk = /^[a-zа-яё\-]{2,16}$/i.test(draft.name.trim());
  return (
    <div>
      <SectionHead step="Шаг 2 · герой" title="Расскажите про героя" subtitle="Имя появится в тексте и на обложке — в именительном падеже." />
      <label className="mb-5 block">
        <span className="mb-1.5 block font-display text-sm font-bold text-pine">Имя ребёнка</span>
        <input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Например: Алиса"
          maxLength={16}
          className="field-input w-full max-w-sm px-4 py-3 text-lg font-extrabold text-pine"
        />
        <span className={cx("mt-1 block text-xs font-bold", nameOk || !draft.name ? "text-ink/40" : "text-coral")}>
          {draft.name && !nameOk ? "2–16 букв, без цифр и пробелов" : "так героя будут звать в сказке"}
        </span>
      </label>
      <p className="mb-1.5 font-display text-sm font-bold text-pine">Возраст</p>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AGE_GROUPS.map((a) => (
          <OptionCard key={a.value} selected={draft.ageGroup === a.value} onClick={() => patch({ ageGroup: a.value })} className="flex-col items-start gap-0.5">
            <span className="font-display text-lg font-bold text-pine">{a.label}</span>
            <span className="text-[11px] font-bold leading-tight text-ink/55">{a.note}</span>
          </OptionCard>
        ))}
      </div>
      <p className="mb-1.5 font-display text-sm font-bold text-pine">Пол</p>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <OptionCard selected={draft.gender === "male"} onClick={() => patch({ gender: "male" })}>
          <span className="font-display text-[16px] font-bold text-pine">Мальчик</span>
        </OptionCard>
        <OptionCard selected={draft.gender === "female"} onClick={() => patch({ gender: "female" })}>
          <span className="font-display text-[16px] font-bold text-pine">Девочка</span>
        </OptionCard>
      </div>
    </div>
  );
}

export function GenreStep({ draft, patch }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 3 · мир" title="В каком мире будет жить история?" subtitle="Жанр определяет декорации, испытания и стиль иллюстраций." />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        {GENRES.map((g) => {
          const Ico = GENRE_ICONS[g.value];
          const sel = draft.genre === g.value;
          return (
            <OptionCard key={g.value} selected={sel} onClick={() => patch({ genre: g.value })} className="flex-col items-start gap-2 p-5">
              <span className={cx("grid h-12 w-12 place-items-center rounded-xl border-[2.5px] border-ink", sel ? "bg-pine text-marigold" : "bg-foam text-moss")}>
                <Ico className="h-7 w-7" />
              </span>
              <span className="font-display text-[17px] font-bold leading-tight text-pine">{g.label}</span>
              <span className="text-[12px] font-bold leading-tight text-ink/55">{g.hint}</span>
            </OptionCard>
          );
        })}
      </div>
    </div>
  );
}

export function CountStep({ draft, patch }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 4 · объём" title="Насколько длинной будет книга?" subtitle="Разворот — это одна иллюстрация с текстовым баннером. Карта героя растянется на весь объём." />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {SPREAD_COUNTS.map((c) => {
          const sel = draft.spreadCount === c.value;
          const pages = c.value / 4;
          return (
            <OptionCard key={c.value} selected={sel} onClick={() => patch({ spreadCount: c.value })} className="flex-col items-start gap-2.5 p-5">
              <span className="flex items-end gap-[3px]" aria-hidden>
                {Array.from({ length: Math.min(pages, 6) }).map((_, i) => (
                  <i key={i} className={cx("w-[7px] rounded-sm border-[1.5px] border-ink", sel ? "bg-marigold" : "bg-foam")} style={{ height: 18 + i * 5 }} />
                ))}
              </span>
              <span className="font-display text-[16px] font-bold text-pine">{c.label}</span>
              <span className="text-[12px] font-bold text-ink/55">{c.note}</span>
            </OptionCard>
          );
        })}
      </div>
    </div>
  );
}

const THEME_ICONS = {
  toys: IconTeddy, darkness: IconMoon, sharing: IconHeart,
  sibling_jealousy: IconUsers, trying_new: IconSprout, surprise_me: IconDice,
} as const;

export function ThemeStep({ draft, patch }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 5 · мораль" title="О чём будет эта история?" subtitle="Тема станет уроком, который герой вынесет из приключения." />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        {THEMES.map((t) => {
          const Ico = THEME_ICONS[t.value];
          const sel = draft.theme === t.value;
          return (
            <OptionCard key={t.value} selected={sel} onClick={() => patch({ theme: t.value })} className={cx("flex-col items-start gap-2 p-5", t.value === "surprise_me" && "border-dashed")}>
              <span className={cx("grid h-12 w-12 place-items-center rounded-xl border-[2.5px] border-ink", sel ? "bg-coral text-paper" : "bg-foam text-berry")}>
                <Ico className="h-7 w-7" />
              </span>
              <span className="font-display text-[16px] font-bold leading-tight text-pine">{t.label}</span>
              <span className="text-[12px] font-bold leading-tight text-ink/55">{t.hint}</span>
            </OptionCard>
          );
        })}
      </div>
    </div>
  );
}

export function CompanionStep({ draft, patch }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 6 · спутник" title="Пойдёт ли с героем спутник?" subtitle="Питомец или любимая игрушка — второй персонаж на каждой странице." />
      <label className="mb-5 flex w-fit cursor-pointer items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-paper px-4 py-3 shadow-block-sm">
        <button
          type="button"
          role="switch"
          aria-checked={draft.hasCompanion}
          onClick={() => patch({ hasCompanion: !draft.hasCompanion })}
          className={cx("relative h-8 w-14 rounded-full border-[2.5px] border-ink transition-colors", draft.hasCompanion ? "bg-fern" : "bg-ink/15")}
        >
          <i className={cx("absolute top-[3px] h-[22px] w-[22px] rounded-full border-2 border-ink bg-paper transition-all", draft.hasCompanion ? "left-[27px]" : "left-[3px]")} />
        </button>
        <span className="font-display text-[15px] font-bold text-pine">{draft.hasCompanion ? "Да, спутник будет" : "Герой отправится один"}</span>
      </label>

      {draft.hasCompanion && (
        <div className="animate-rise">
          <p className="mb-1.5 font-display text-sm font-bold text-pine">Кто это?</p>
          <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
            {COMPANION_TYPES.map((t) => {
              const Ico = COMPANION_TYPE_ICONS[t.value];
              return (
                <OptionCard key={t.value} selected={draft.companionType === t.value} onClick={() => patch({ companionType: t.value })}>
                  <Ico className="h-6 w-6 shrink-0 text-moss" />
                  <span className="font-display text-[15px] font-bold text-pine">{t.label}</span>
                </OptionCard>
              );
            })}
          </div>
          <label className="mb-5 block max-w-sm">
            <span className="mb-1.5 block font-display text-sm font-bold text-pine">Как зовут спутника?</span>
            <input
              value={draft.companionName}
              onChange={(e) => patch({ companionName: e.target.value })}
              placeholder="Например: Барсик"
              maxLength={16}
              className="field-input w-full px-4 py-3 text-lg font-extrabold text-pine"
            />
            {draft.companionPhotos.length > 0 && (
              <span className="mt-1 block text-xs font-bold text-fern">фото загружено — используем как референс иллюстратора</span>
            )}
          </label>
          <p className="mb-1.5 font-display text-sm font-bold text-pine">Роль в истории</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {COMPANION_ROLES.map((r) => {
              const Ico = COMPANION_ROLE_ICONS[r.value];
              return (
                <OptionCard key={r.value} selected={draft.companionRole === r.value} onClick={() => patch({ companionRole: r.value })} className="flex-col items-start gap-1.5 p-4">
                  <Ico className="h-6 w-6 text-sea" />
                  <span className="font-display text-[13.5px] font-bold leading-tight text-pine">{r.label}</span>
                  <span className="text-[11px] font-bold leading-tight text-ink/50">{r.hint}</span>
                </OptionCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PaletteStep({ draft, patch }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 7 · палитра" title="Выберите настроение красок" subtitle="Семь цветов набора станут акцентами каждой иллюстрации и баннером текста." />
      <div className="grid gap-3.5">
        {PALETTES.map((p) => {
          const sel = draft.paletteId === p.id;
          return (
            <OptionCard key={p.id} selected={sel} onClick={() => patch({ paletteId: p.id })} className="gap-4 p-4">
              <span className="flex shrink-0 -space-x-2">
                {p.colors.map((c) => (
                  <i key={c} className={cx("h-9 w-9 rounded-full border-[2.5px] border-ink transition-transform", sel && "scale-110")} style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[16px] font-bold text-pine">{p.name}</span>
                <span className="block truncate text-[12px] font-bold text-ink/50">{p.colors.join(" · ")}</span>
              </span>
            </OptionCard>
          );
        })}
      </div>
    </div>
  );
}

export function ExtrasStep({ draft, patch }: StepProps) {
  return (
    <div>
      <SectionHead step="Шаг 8 · детали" title="Любимые места и занятия" subtitle="Необязательно, но рассказчик вплетёт их в сюжет: герой вспомнит дом в трудную минуту." />
      <div className="grid max-w-2xl gap-4">
        <label className="block">
          <span className="mb-1.5 block font-display text-sm font-bold text-pine">Любимое место</span>
          <input value={draft.favoritePlace} onChange={(e) => patch({ favoritePlace: e.target.value })} placeholder="Например: бабушкина дача" maxLength={40} className="field-input w-full px-4 py-3 font-bold text-pine" />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-display text-sm font-bold text-pine">Любимое занятие</span>
          <input value={draft.favoriteActivity} onChange={(e) => patch({ favoriteActivity: e.target.value })} placeholder="Например: рисовать динозавров" maxLength={40} className="field-input w-full px-4 py-3 font-bold text-pine" />
        </label>
        <div className="flex flex-wrap gap-2">
          {["бабушкина дача", "рисовать динозавров", "кататься на самокате", "читать про космос", "строить шалаши"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (s.includes("дач")) patch({ favoritePlace: s });
                else patch({ favoriteActivity: s });
              }}
              className="rounded-full border-2 border-ink/25 bg-foam px-3 py-1.5 text-xs font-bold text-ink/60 transition-colors hover:border-marigold hover:text-pine"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConfirmStep({ input, onGenerate, busy }: { input: BookInput; onGenerate: () => void; busy: boolean }) {
  const [showJson, setShowJson] = useState(false);
  const rows: Array<[string, string]> = [
    ["Герой", `${input.child.name}, ${input.child.age_group} лет, ${input.child.gender === "male" ? "мальчик" : "девочка"}`],
    ["Жанр", GENRES.find((g) => g.value === input.genre)?.label ?? input.genre],
    ["Объём", `${input.spread_count} разворотов`],
    ["Тема", THEMES.find((t) => t.value === input.story_theme)?.label ?? input.story_theme],
    ["Спутник", input.companion.name ? `${input.companion.name} (${input.companion.type === "pet" ? "питомец" : "игрушка"}, ${COMPANION_ROLES.find((r) => r.value === input.companion.role)?.label.toLowerCase() ?? "—"})` : "без спутника"],
    ["Палитра", PALETTES.find((p) => p.id === input.palette_id)?.name ?? input.palette_id],
    ["Любимое место", input.personal_details.favorite_place ?? "—"],
    ["Любимое занятие", input.personal_details.favorite_activity ?? "—"],
  ];
  return (
    <div>
      <SectionHead step="Шаг 9 · проверка" title="Всё верно? Собираем книгу" subtitle="Input JSON уйдёт в Narrative Module: история → модерация → иллюстрации → вёрстка → PDF." />
      <div className="mb-5 overflow-hidden rounded-2xl border-[2.5px] border-ink bg-foam">
        {rows.map(([k, v], i) => (
          <div key={k} className={cx("flex items-baseline justify-between gap-4 px-4 py-2.5", i > 0 && "border-t-2 border-ink/10")}>
            <span className="shrink-0 font-display text-[12px] font-bold uppercase tracking-wider text-ink/50">{k}</span>
            <span className="text-right text-[15px] font-extrabold text-pine">{v}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowJson((v) => !v)}
        className="mb-5 rounded-lg border-2 border-ink/20 px-3 py-1.5 font-display text-xs font-bold text-ink/60 transition-colors hover:border-ink hover:text-pine"
      >
        {showJson ? "скрыть Input JSON" : "показать Input JSON"}
      </button>
      {showJson && (
        <pre className="log-scroll mb-5 max-h-64 overflow-auto rounded-xl border-[2.5px] border-ink bg-pine p-4 text-[12px] font-semibold leading-relaxed text-foam">
{JSON.stringify(input, null, 2)}
        </pre>
      )}
      <ChunkyButton variant="coral" onClick={onGenerate} disabled={busy} className="w-full py-4 text-[17px] sm:w-auto sm:px-10">
        Сгенерировать книгу
      </ChunkyButton>
    </div>
  );
}

export function StepNav({
  onBack, onNext, canNext, nextLabel, hint,
}: {
  onBack?: () => void;
  onNext: () => void;
  canNext: boolean;
  nextLabel?: string;
  hint?: string;
}) {
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3 border-t-2 border-dashed border-ink/20 pt-5">
      {onBack && <ChunkyButton variant="ghost" onClick={onBack}>Назад</ChunkyButton>}
      <ChunkyButton onClick={onNext} disabled={!canNext}>{nextLabel ?? "Дальше"}</ChunkyButton>
      {!canNext && hint && <span className="text-[13px] font-bold text-coral">{hint}</span>}
    </div>
  );
}
