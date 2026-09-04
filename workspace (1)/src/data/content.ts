import type {
  AgeGroup, CompanionRole, CompanionType, Genre, Stage, StoryTheme,
} from "../types";

export interface Palette {
  id: string;
  name: string;
  /** [ink, deep, mid, light, paper, warm, cool] */
  colors: [string, string, string, string, string, string, string];
}

export const PALETTES: Palette[] = [
  { id: "pine", name: "Хвойный вечер", colors: ["#17352b", "#275e49", "#4b8464", "#9cc5a1", "#f4ead8", "#f2b33d", "#3f8f8a"] },
  { id: "berry", name: "Ягодный сад", colors: ["#3d2b3d", "#6d597a", "#a06a8f", "#e8b4c8", "#fdf3e7", "#e4572e", "#7fb069"] },
  { id: "sea", name: "Морская пена", colors: ["#0f2e3d", "#1d5a70", "#3f8f8a", "#8fc7c0", "#eef7f2", "#f2b33d", "#e4572e"] },
  { id: "sun", name: "Полдень в прерии", colors: ["#4a3423", "#7a5230", "#c98a3d", "#e8c07a", "#fdf6e3", "#e4572e", "#5a8f6a"] },
  { id: "night", name: "Северная ночь", colors: ["#12203a", "#274060", "#4a6a9a", "#9ab8d8", "#e8f0f5", "#f2b33d", "#b0785a"] },
];

export const getPalette = (id: string): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

export const GENRES: Array<{ value: Genre; label: string; hint: string }> = [
  { value: "fairy_tale", label: "Сказка", hint: "замки, драконы и чудеса" },
  { value: "space", label: "Космос", hint: "звёзды и планеты" },
  { value: "superhero", label: "Супергерой", hint: "смелость и добрые дела" },
  { value: "forest", label: "Лес", hint: "тропинки и лесные жители" },
  { value: "underwater", label: "Подводный мир", hint: "кораллы и рыбки" },
  { value: "pirates", label: "Пираты", hint: "море и карты сокровищ" },
];

export const THEMES: Array<{ value: StoryTheme; label: string; hint: string }> = [
  { value: "toys", label: "Игрушки", hint: "беречь свои вещи" },
  { value: "darkness", label: "Темнота", hint: "не бояться темноты" },
  { value: "sharing", label: "Делиться", hint: "дружить и делиться" },
  { value: "sibling_jealousy", label: "Ревность к брату/сестре", hint: "места в сердце хватит всем" },
  { value: "trying_new", label: "Новое", hint: "не бояться пробовать" },
  { value: "surprise_me", label: "Удиви меня", hint: "тему выберет рассказчик" },
];

export const AGE_GROUPS: Array<{ value: AgeGroup; label: string; note: string }> = [
  { value: "2-3", label: "2–3", note: "короткие фразы" },
  { value: "4-5", label: "4–5", note: "простой сюжет" },
  { value: "6-7", label: "6–7", note: "приключения" },
  { value: "8-9", label: "8–9", note: "сложные истории" },
];

export const SPREAD_COUNTS: Array<{ value: number; label: string; note: string }> = [
  { value: 12, label: "12 разворотов", note: "короткая · ~5 минут" },
  { value: 16, label: "16 разворотов", note: "стандарт · ~8 минут" },
  { value: 20, label: "20 разворотов", note: "большая · ~10 минут" },
  { value: 24, label: "24 разворота", note: "огромная · ~15 минут" },
];

export const COMPANION_TYPES: Array<{ value: CompanionType; label: string }> = [
  { value: "pet", label: "Питомец" },
  { value: "toy", label: "Игрушка" },
];

export const COMPANION_ROLES: Array<{ value: CompanionRole; label: string; hint: string }> = [
  { value: "protector", label: "Защитник", hint: "всегда рядом в трудную минуту" },
  { value: "joker", label: "Помощник-шутник", hint: "разряжает обстановку" },
  { value: "advisor", label: "Советчик", hint: "подсказывает мудрые идеи" },
  { value: "cheerleader", label: "Подбадривает", hint: "верит в героя больше всех" },
];

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  ordinary_world: { label: "обычный мир", color: "#3f8f8a" },
  call_to_adventure: { label: "зов приключения", color: "#f2b33d" },
  trial: { label: "испытание", color: "#6d597a" },
  climax: { label: "кульминация", color: "#e4572e" },
  return_lesson: { label: "возвращение", color: "#7fb069" },
};

/** Жёсткие правила для Illustration Module — в каждом промпте */
export const ILLUSTRATION_NEGATIVE =
  "NEVER: character looking directly at viewer/camera, direct eye contact with the reader, " +
  "posed portrait framing, frontal symmetrical stance, glossy 3D render, vibrant oversaturated colors, " +
  "photorealistic rendering, empty/sparse background";

export const ILLUSTRATION_POSITIVE =
  "ALWAYS: hand-drawn storybook illustration style, visible watercolor/pencil texture, " +
  "character's gaze and body oriented toward the action or other characters in the scene, " +
  "candid mid-action framing, filled but not cluttered background with environmental detail, " +
  "muted earthy color palette using provided palette colors as accents";
