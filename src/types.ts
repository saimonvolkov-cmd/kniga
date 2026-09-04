export type AgeGroup = "2-3" | "4-5" | "6-7" | "8-9";
export type Gender = "male" | "female";
export type Genre = "fairy_tale" | "space" | "superhero" | "forest" | "underwater" | "pirates";
export type StoryTheme = "toys" | "darkness" | "sharing" | "sibling_jealousy" | "trying_new" | "surprise_me";
export type CompanionType = "pet" | "toy";
export type CompanionRole = "protector" | "joker" | "advisor" | "cheerleader";
export type CompanionKind = "cat" | "dog" | "bunny" | "bear" | "robot" | "fox";
export type Stage = "ordinary_world" | "call_to_adventure" | "trial" | "climax" | "return_lesson";

/** Input JSON — из опроса в Narrative Module */
export interface BookInput {
  child: { name: string; age_group: AgeGroup; gender: Gender };
  companion: { name: string | null; type: CompanionType | null; role: CompanionRole | null };
  genre: Genre;
  story_theme: StoryTheme;
  spread_count: number;
  personal_details: { favorite_place: string | null; favorite_activity: string | null };
  palette_id: string;
}

export interface Spread {
  spread_number: number;
  stage: Stage;
  text: string;
  scene_description: string;
  characters_present: string[];
  gaze_direction: string;
  emotion: string;
}

/** Story JSON — выход Narrative Module */
export interface StoryJSON {
  title: string;
  word_limit_per_spread: number;
  cover: { scene_description: string; title_text: string };
  back_cover: { scene_description: string; blurb_text: string };
  hero_journey_map: Record<Stage, number[]>;
  spreads: Spread[];
}

export interface SurveyDraft {
  childPhotos: string[];
  companionPhotos: string[];
  name: string;
  ageGroup: AgeGroup | null;
  gender: Gender | null;
  genre: Genre | null;
  spreadCount: number | null;
  theme: StoryTheme | null;
  hasCompanion: boolean;
  companionName: string;
  companionType: CompanionType;
  companionRole: CompanionRole | null;
  paletteId: string;
  favoritePlace: string;
  favoriteActivity: string;
}

export type EngineKind = "demo" | "gemini" | "gemini+claude" | "yandex-gpt";
export type StoryProvider = "anthropic" | "yandex-gpt" | "gemini";
/** какой провайдер нарисовал страницу */
export type ImageSource = "gemini" | "yandex-art" | "huggingface" | "pollinations" | "demo";
/** cloud = Yandex Cloud Functions · backend = локальный Express-прокси · off = ничего */
export type ConnMode = "cloud" | "backend" | "off";

export interface GeneratedPage {
  kind: "cover" | "spread" | "back";
  image: string;
  spread?: Spread;
  imageSource?: ImageSource;
  imageError?: string;
}

export interface GeneratedBook {
  input: BookInput;
  story: StoryJSON;
  pages: GeneratedPage[];
  engine: EngineKind;
  moderated: { checked: number; blocked: number; softened: number };
  seed: number;
  imageReport?: { gemini: number; yandex: number; hf: number; pollinations: number; demo: number; firstError: string | null };
}

export interface ApiKeys {
  gemini: string;
  anthropic: string;
  huggingface: string;
  yandexApiKey: string;
  yandexFolderId: string;
}

export type PipelineStageId = "story" | "safety" | "reference" | "cover" | "spreads" | "layout" | "assemble";

export interface PipelineStepState {
  id: PipelineStageId;
  label: string;
  status: "pending" | "active" | "done" | "warn";
  detail?: string;
}
