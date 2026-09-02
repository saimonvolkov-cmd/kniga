import type { AgeGroup, CompanionRole, CompanionType, Genre, StoryTheme, Stage } from "../types";

/* ── Палитры: 5 наборов по 7 цветов (роль каждого цвета фиксирована) ───── */
export interface Palette {
  id: string;
  name: string;
  /** [ink, deep, mid, light, paper, warm, cool] */
  colors: [string, string, string, string, string, string, string];
}

export const PALETTES: Palette[] = [
  { id: "pine", name: "Хвойный лес", colors: ["#22332c", "#2f5d50", "#7fb069", "#d9e8cd", "#f4f1de", "#f2b33d", "#8fbcb0"] },
  { id: "sunset", name: "Тёплый закат", colors: ["#432f38", "#8c4a5f", "#d97b6c", "#f5c99b", "#fdf0dc", "#f2a65a", "#7fa98f"] },
  { id: "sea", name: "Морская", colors: ["#14343b", "#1e6573", "#3fa7a3", "#a6d8cb", "#eef4e9", "#f2b33d", "#e8604c"] },
  { id: "caramel", name: "Карамель", colors: ["#4a2f23", "#8c5a3c", "#c98a5b", "#ecc89a", "#f8edd8", "#d96c47", "#7fa98f"] },
  { id: "night", name: "Звёздная ночь", colors: ["#20304f", "#3c5a80", "#7fa8c9", "#c9dcea", "#f6eedf", "#f2b33d", "#e8604c"] },
];

export const getPalette = (id: string | null): Palette =>
  PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/* ── Словари опроса ─────────────────────────────────────────────────────── */

export const AGE_GROUPS: Array<{ value: AgeGroup; label: string; note: string }> = [
  { value: "2-3", label: "2–3 года", note: "короткие фразы, много повторов" },
  { value: "4-5", label: "4–5 лет", note: "простые предложения, игра" },
  { value: "6-7", label: "6–7 лет", note: "сюжет с деталями" },
  { value: "8-9", label: "8–9 лет", note: "сложнее образы и юмор" },
];

export const GENRES: Array<{ value: Genre; label: string; hint: string }> = [
  { value: "fairy_tale", label: "Сказка", hint: "замки, драконы, чудеса" },
  { value: "space", label: "Космос", hint: "ракеты, планеты, киты из звёзд" },
  { value: "superhero", label: "Супергерой", hint: "добрый герой своего двора" },
  { value: "forest", label: "Лес", hint: "тропинки, грибы, фонарщик" },
  { value: "underwater", label: "Подводный мир", hint: "кораллы, жемчужины, китята" },
  { value: "pirates", label: "Пираты", hint: "карты, бриги, какао-бухта" },
];

export const SPREAD_COUNTS: Array<{ value: 12 | 16 | 20 | 24; label: string; note: string }> = [
  { value: 12, label: "12 разворотов", note: "≈ 4 минуты чтения" },
  { value: 16, label: "16 разворотов", note: "≈ 6 минут чтения" },
  { value: 20, label: "20 разворотов", note: "≈ 8 минут чтения" },
  { value: 24, label: "24 разворота", note: "≈ 10 минут чтения" },
];

export const THEMES: Array<{ value: StoryTheme; label: string; hint: string }> = [
  { value: "toys", label: "Игрушки", hint: "почему игрушки важно беречь" },
  { value: "darkness", label: "Темнота", hint: "темнота — не страшно" },
  { value: "sharing", label: "Делиться", hint: "разделённая радость больше" },
  { value: "sibling_jealousy", label: "Ревность к брату/сестре", hint: "вы — одна команда" },
  { value: "trying_new", label: "Новое", hint: "попробовать — уже победа" },
  { value: "surprise_me", label: "Удиви меня", hint: "тему выберет рассказчик" },
];

export const COMPANION_ROLES: Array<{ value: CompanionRole; label: string; hint: string }> = [
  { value: "protector", label: "Защитник", hint: "идёт первым, распушив хвост" },
  { value: "joker", label: "Помощник-шутник", hint: "смехом прогоняет любую беду" },
  { value: "advisor", label: "Советчик", hint: "шепчет мудрость на ушко" },
  { value: "cheerleader", label: "Тот, кто подбадривает", hint: "кричит «Ты сможешь!»" },
];

export const COMPANION_TYPES: Array<{ value: CompanionType; label: string }> = [
  { value: "pet", label: "Питомец" },
  { value: "toy", label: "Игрушка" },
];

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  ordinary_world: { label: "обычный мир", color: "#7fb069" },
  call_to_adventure: { label: "зов приключения", color: "#f2b33d" },
  trial: { label: "испытание", color: "#e8604c" },
  climax: { label: "кульминация", color: "#b9536f" },
  return_lesson: { label: "возвращение и урок", color: "#3f8f8a" },
};

/* Жёсткие правила иллюстратора — включаются в КАЖДЫЙ вызов генерации */
export const ILLUSTRATION_NEGATIVE =
  "NEVER: character looking directly at viewer/camera, direct eye contact with the reader, " +
  "posed portrait framing, frontal symmetrical stance, glossy 3D render, vibrant oversaturated colors, " +
  "photorealistic rendering, empty/sparse background, text, words, letters, watermark";

export const ILLUSTRATION_POSITIVE =
  "ALWAYS: hand-drawn storybook illustration style, visible watercolor/pencil texture, " +
  "character's gaze and body oriented toward the action or other characters in the scene, " +
  "candid mid-action framing, filled but not cluttered background with environmental detail, " +
  "muted earthy color palette using provided palette colors as accents, square 1:1 composition";
