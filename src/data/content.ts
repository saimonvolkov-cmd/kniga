import type { AgeGroup, CompanionRole, CompanionType, Genre, Stage, StoryTheme } from "../types";

/* ── Палитры: 5 наборов по 7 цветов ─────────────────────────────────────── */
export interface Palette {
  id: string;
  name: string;
  colors: [string, string, string, string, string, string, string];
}

export const PALETTES: Palette[] = [
  { id: "pine", name: "Сосновый бор", colors: ["#17352b", "#2d5a45", "#5c8a6b", "#a8c3a0", "#f4ead8", "#f2b33d", "#3f8f8a"] },
  { id: "sunset", name: "Тёплый закат", colors: ["#4a2c2a", "#8a4b3a", "#c4703f", "#e8a25e", "#fbeed3", "#e4572e", "#5c7f71"] },
  { id: "sea", name: "Глубокое море", colors: ["#12303e", "#1f5068", "#3f8f8a", "#8fc0b0", "#f0ecdc", "#f2b33d", "#e4572e"] },
  { id: "berry", name: "Ягодный лес", colors: ["#33202e", "#6d597a", "#9a7aa0", "#c9a7c7", "#f6eef2", "#f2b33d", "#3f7d3f"] },
  { id: "clay", name: "Глина и охра", colors: ["#3e2e23", "#7a5c3e", "#b08954", "#d9b98a", "#f7eed9", "#c96f4a", "#6f7d5c"] },
];

export const getPalette = (id: string | null): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/* ── Опции опроса ───────────────────────────────────────────────────────── */
export const AGE_GROUPS: Array<{ value: AgeGroup; label: string; note: string }> = [
  { value: "2-3", label: "2–3 года", note: "короткие фразы" },
  { value: "4-5", label: "4–5 лет", note: "простой сюжет" },
  { value: "6-7", label: "6–7 лет", note: "приключение" },
  { value: "8-9", label: "8–9 лет", note: "сложнее сюжет" },
];

export const GENRES: Array<{ value: Genre; label: string; hint: string }> = [
  { value: "fairy_tale", label: "Сказка", hint: "замки, фонари, волшебство" },
  { value: "space", label: "Космос", hint: "звёзды, ракеты, планеты" },
  { value: "superhero", label: "Супергерой", hint: "плащ, город, подвиги" },
  { value: "forest", label: "Лес", hint: "тропинки, совы, грибы" },
  { value: "underwater", label: "Подводный мир", hint: "кораллы, киты, жемчуг" },
  { value: "pirates", label: "Пираты", hint: "карты, бриги, маяки" },
];

export const SPREAD_COUNTS: Array<{ value: 12 | 16 | 20 | 24; label: string; note: string }> = [
  { value: 12, label: "12 разворотов", note: "короткая · ~10 минут" },
  { value: 16, label: "16 разворотов", note: "классика · ~15 минут" },
  { value: 20, label: "20 разворотов", note: "большая · ~20 минут" },
  { value: 24, label: "24 разворота", note: "огромная · на вечер" },
];

export const THEMES: Array<{ value: StoryTheme; label: string; hint: string }> = [
  { value: "toys", label: "Игрушки", hint: "бережно относиться к вещам" },
  { value: "darkness", label: "Темнота", hint: "не бояться темноты" },
  { value: "sharing", label: "Делиться", hint: "щедрость делает сильнее" },
  { value: "sibling_jealousy", label: "Ревность к брату/сестре", hint: "места хватит всем" },
  { value: "trying_new", label: "Новое", hint: "пробовать — это смело" },
  { value: "surprise_me", label: "Удиви меня", hint: "пусть решит рассказчик" },
];

export const COMPANION_TYPES: Array<{ value: CompanionType; label: string }> = [
  { value: "pet", label: "Питомец" },
  { value: "toy", label: "Игрушка" },
];

export const COMPANION_ROLES: Array<{ value: CompanionRole; label: string; hint: string }> = [
  { value: "protector", label: "Защитник", hint: "встаёт между героем и бедой" },
  { value: "joker", label: "Помощник-шутник", hint: "разряжает обстановку" },
  { value: "advisor", label: "Советчик", hint: "подсказывает тихим словом" },
  { value: "cheerleader", label: "Подбадривает", hint: "верит в героя громче всех" },
];

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  ordinary_world: { label: "Обычный мир", color: "#5c8a6b" },
  call_to_adventure: { label: "Зов приключения", color: "#f2b33d" },
  trial: { label: "Испытание", color: "#3f8f8a" },
  climax: { label: "Кульминация", color: "#e4572e" },
  return_lesson: { label: "Возвращение и урок", color: "#6d597a" },
};

/* ── Жёсткие правила Illustration Module (каждый вызов, включая обложку) ── */
export const ILLUSTRATION_NEGATIVE =
  "NEVER: character looking directly at viewer/camera, direct eye contact with the reader, " +
  "posed portrait framing, frontal symmetrical stance, glossy 3D render, vibrant oversaturated colors, " +
  "photorealistic rendering, empty/sparse background, text or letters inside the image";

export const ILLUSTRATION_POSITIVE =
  "ALWAYS: hand-drawn storybook illustration style, visible watercolor/pencil texture, " +
  "character's gaze and body oriented toward the action or other characters in the scene, " +
  "candid mid-action framing, filled but not cluttered background with environmental detail, " +
  "muted earthy color palette using provided palette_id colors as accents, square 1:1 composition";
