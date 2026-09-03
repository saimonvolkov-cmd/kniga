import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiKeys, BookInput, GeneratedBook, GeneratedPage, ImageSource, PipelineStageId, PipelineStepState, SurveyDraft,
} from "./types";
import { getPalette } from "./data/content";
import {
  generateStoryViaApi, loadKeys, generateIllustration, resetQuotaBreaker,
  detectConnection, isQuotaError, type ConnMode, type ImageCallResult,
} from "./lib/api";
import { moderateStory } from "./lib/safety";
import { KIND_NOUN } from "./lib/storyEngine";
import { buildImagePrompt, focalForSpread, pickCompanionKind, renderBackScene, renderCoverScene, renderScene } from "./lib/illustrator";
import type { SceneSpec } from "./lib/illustrator";
import { exportBookPdf, pdfFileName } from "./lib/pdf";
import { delay, plural } from "./lib/utils";
import { ChunkyButton, cx, Toasts, type ToastItem } from "./components/ui";
import { CoverPreview } from "./components/CoverPreview";
import {
  ChildStep, CompanionStep, ConfirmStep, CountStep, draftToInput, emptyDraft, ExtrasStep,
  GenreStep, PaletteStep, PhotoStep, StepNav, ThemeStep,
} from "./components/steps";
import { ProgressScreen } from "./components/ProgressScreen";
import { BookScreen } from "./components/BookScreen";
import { ApiTestPanel } from "./components/ApiTestPanel";
import { IconBook, IconCheck, IconMoon, IconSparkle, IconStar } from "./components/icons";

type Phase = "survey" | "progress" | "book";

const CHAPTERS = [
  { label: "Фото", hint: "референсы" },
  { label: "Герой", hint: "имя и возраст" },
  { label: "Жанр", hint: "мир истории" },
  { label: "Объём", hint: "развороты" },
  { label: "Тема", hint: "мораль" },
  { label: "Спутник", hint: "питомец/игрушка" },
  { label: "Палитра", hint: "7 цветов" },
  { label: "Детали", hint: "места и занятия" },
  { label: "Финал", hint: "проверка" },
];

const PIPELINE: Array<{ id: PipelineStageId; label: string }> = [
  { id: "story", label: "История — Narrative Module (Claude Sonnet)" },
  { id: "safety", label: "Модерация — Content Safety (Claude Haiku)" },
  { id: "reference", label: "Референс персонажа — Character Reference" },
  { id: "cover", label: "Обложки — Cover Module (Gemini / HF)" },
  { id: "spreads", label: "Развороты — Illustration Module (Gemini / HF)" },
  { id: "layout", label: "Вёрстка баннеров — Layout Module" },
  { id: "assemble", label: "Сборка PDF — Export Module" },
];

export default function App() {
  const [phase, setPhase] = useState<Phase>("survey");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SurveyDraft>(emptyDraft());
  const [seed, setSeed] = useState(7);
  /** легаси-ключи из localStorage (окно ввода убрано — ключи живут в .env / yandex.env.json) */
  const [keys] = useState<ApiKeys>(() => loadKeys());
  const [book, setBook] = useState<GeneratedBook | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [pipeSteps, setPipeSteps] = useState<PipelineStepState[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [latest, setLatest] = useState<GeneratedPage | null>(null);
  const [exporting, setExporting] = useState<null | { done: number; total: number }>(null);
  const [pdfInfo, setPdfInfo] = useState<null | { name: string; kb: number; pages: number }>(null);
  const [generating, setGenerating] = useState(false);
  /** первая ошибка API-иллюстраций за прогон — видна на экране прогресса и в книге */
  const [geminiError, setGeminiError] = useState<string | null>(null);
  /** какой канал Yandex активен: бэкенд /api · yandex.env.json · офлайн */
  const [connMode, setConnMode] = useState<ConnMode | "checking">("checking");
  useEffect(() => {
    void detectConnection().then(setConnMode);
  }, []);

  const runToken = useRef(0);
  const toastId = useRef(0);

  const palette = getPalette(draft.paletteId);
  const input = useMemo(() => draftToInput(draft), [draft]);

  const toast = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase, step]);

  const patch = useCallback((p: Partial<SurveyDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  const nameOk = /^[a-zа-яё\-]{2,16}$/i.test(draft.name.trim());
  const stepState = (i: number): { canNext: boolean; hint?: string } => {
    switch (i) {
      case 1:
        if (!nameOk) return { canNext: false, hint: "введите имя (2–16 букв)" };
        if (!draft.ageGroup) return { canNext: false, hint: "выберите возраст" };
        if (!draft.gender) return { canNext: false, hint: "выберите пол" };
        return { canNext: true };
      case 2: return draft.genre ? { canNext: true } : { canNext: false, hint: "выберите жанр" };
      case 3: return draft.spreadCount ? { canNext: true } : { canNext: false, hint: "выберите объём" };
      case 4: return draft.theme ? { canNext: true } : { canNext: false, hint: "выберите тему" };
      case 5:
        if (!draft.hasCompanion) return { canNext: true };
        if (!draft.companionName.trim()) return { canNext: false, hint: "как зовут спутника?" };
        if (!draft.companionRole) return { canNext: false, hint: "выберите роль спутника" };
        return { canNext: true };
      default: return { canNext: true };
    }
  };

  /* ── пайплайн генерации ───────────────────────────────────────────────── */
  const runPipeline = useCallback(
    async (inp: BookInput, activeSeed: number) => {
      const token = ++runToken.current;
      const cancelled = () => runToken.current !== token;
      resetQuotaBreaker();
      setGeminiError(null);
      setGenerating(true);
      setPhase("progress");
      setBook(null);
      setPages([]);
      setLatest(null);
      setLog([]);
      setPdfInfo(null);
      setPipeSteps(PIPELINE.map((p) => ({ ...p, status: "pending" as const })));

      const addLog = (s: string) => setLog((l) => [...l, s]);
      const setSt = (id: PipelineStageId, status: PipelineStepState["status"], detail?: string) =>
        setPipeSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail: detail ?? s.detail } : s)));
      const currentPalette = getPalette(inp.palette_id);

      let firstErr: string | null = null;
      const viaLabel: Record<string, string> = {
        gemini: "Gemini",
        "yandex-art": "YandexART",
        huggingface: "Hugging Face",
        pollinations: "Pollinations",
      };
      const noteImage = (r: ImageCallResult) => {
        if (r.dataUrl) return;
        const prefix = viaLabel[r.via ?? "gemini"] ?? "Gemini";
        addLog(`${prefix}: ${r.error}`);
        if (!firstErr) {
          firstErr = r.error ?? "неизвестная ошибка";
          setGeminiError(firstErr);
          toast(
            "warn",
            isQuotaError(r.error)
              ? "У ключа нулевая квота на картинки — нужен платный тариф или другой провайдер"
              : "API-иллюстрации недоступны — дальше пойдут демо. Причина написана на экране."
          );
        }
      };
      const sourceOf = (r: ImageCallResult): ImageSource =>
        r.dataUrl ? ((r.via as ImageSource) ?? "gemini") : "demo";
      const labelOf = (r: ImageCallResult): string =>
        r.dataUrl ? viaLabel[r.via ?? "gemini"] ?? "Gemini" : "демо-SVG";

      console.log("[Input JSON → Narrative Module]", inp);
      addLog("Survey: Input JSON собран и отправлен в Narrative Module");

      /* 1 — история */
      setSt("story", "active");
      addLog(
        connMode === "backend"
          ? "Narrative: история через прокси /api/yandex/generate-text (YandexGPT, ключ на сервере)"
          : "Narrative: Yandex не настроен — история через локальный движок"
      );
      const { story, engine } = await generateStoryViaApi(inp, keys, activeSeed);
      if (cancelled()) return;
      console.log("[Story JSON]", story);
      setSt("story", "done", `«${story.title}» · ${story.spreads.length} ${plural(story.spreads.length, "разворот", "разворота", "разворотов")}`);
      addLog(`Narrative: Story JSON готов — «${story.title}», ${story.spreads.length} разворотов, ≤${story.word_limit_per_spread} слов`);

      /* 2 — модерация */
      setSt("safety", "active");
      addLog("Safety: фильтр ALLOW/BLOCK по каждому развороту…");
      const report = await moderateStory(story, keys);
      if (cancelled()) return;
      setSt("safety", report.blocked ? "warn" : "done", `${report.checked - report.blocked} ALLOW · ${report.blocked} BLOCK`);
      addLog(report.blocked ? `Safety: ${report.blocked} BLOCK → текст перегенерирован мягче` : `Safety: все ${report.checked} разворотов ALLOW`);

      /* 3 — референс персонажа */
      setSt("reference", "active");
      await delay(420);
      if (cancelled()) return;
      const kind = pickCompanionKind(inp, activeSeed);
      setSt(
        "reference", "done",
        kind ? `${KIND_NOUN[kind]} «${inp.companion.name}» · фото-референсов: ${draft.companionPhotos.length + draft.childPhotos.length}` : "герой без спутника"
      );
      addLog(kind ? `Reference: образ зафиксирован — ${KIND_NOUN[kind]} по имени ${inp.companion.name}` : "Reference: спутник не заявлен");

      /* 4 — обложки (Gemini → Hugging Face → демо) */
      setSt("cover", "active", "передняя обложка");
      addLog("Cover: генерирую переднюю обложку…");
      const coverPrompt = `${buildImagePrompt(inp, null, currentPalette, "cover")} Scene: ${story.cover.scene_description}.`;
      const coverRes = await generateIllustration(coverPrompt, draft.childPhotos, keys);
      if (cancelled()) return;
      noteImage(coverRes);
      let coverImg = coverRes.dataUrl;
      if (!coverImg) {
        coverImg = renderCoverScene(inp, currentPalette, activeSeed, kind);
        await delay(520);
        if (cancelled()) return;
      }
      const coverPage: GeneratedPage = { kind: "cover", image: coverImg, imageSource: sourceOf(coverRes), imageError: coverRes.dataUrl ? undefined : coverRes.error ?? undefined };
      setLatest(coverPage);
      addLog(`Cover: передняя обложка готова (${labelOf(coverRes)})`);

      setSt("cover", "active", "задняя обложка");
      addLog("Cover: генерирую заднюю обложку…");
      const backPrompt = `${buildImagePrompt(inp, null, currentPalette, "back")} Scene: ${story.back_cover.scene_description}.`;
      const backRes = await generateIllustration(backPrompt, [], keys);
      if (cancelled()) return;
      noteImage(backRes);
      let backImg = backRes.dataUrl;
      if (!backImg) {
        backImg = renderBackScene(inp, currentPalette, activeSeed);
        await delay(420);
        if (cancelled()) return;
      }
      const backPage: GeneratedPage = { kind: "back", image: backImg, imageSource: sourceOf(backRes), imageError: backRes.dataUrl ? undefined : backRes.error ?? undefined };
      addLog(`Cover: задняя обложка готова (${labelOf(backRes)})`);
      setSt(
        "cover",
        coverRes.dataUrl && backRes.dataUrl ? "done" : "warn",
        `передняя: ${labelOf(coverRes)} · задняя: ${labelOf(backRes)}`
      );

      /* 5 — развороты по одному */
      const acc: GeneratedPage[] = [coverPage];
      setPages([...acc]);
      for (let i = 0; i < story.spreads.length; i++) {
        const sp = story.spreads[i];
        setSt("spreads", "active", `разворот ${i + 1} / ${story.spreads.length}`);
        const prompt = buildImagePrompt(inp, sp, currentPalette, "spread");
        const res = await generateIllustration(prompt, draft.childPhotos, keys);
        if (cancelled()) return;
        noteImage(res);
        let img = res.dataUrl;
        if (!img) {
          const spec: SceneSpec = {
            genre: inp.genre, palette: currentPalette, seed: activeSeed, gender: inp.child.gender,
            companionKind: kind, stage: sp.stage, emotion: sp.emotion,
            focal: focalForSpread(inp.genre, sp), spreadNumber: sp.spread_number,
          };
          img = renderScene(spec);
          await delay(230 + ((i * 53) % 190));
          if (cancelled()) return;
        }
        const page: GeneratedPage = { kind: "spread", image: img, spread: sp, imageSource: sourceOf(res), imageError: res.dataUrl ? undefined : res.error ?? undefined };
        acc.push(page);
        setPages([...acc]);
        setLatest(page);
        addLog(`Illustration: разворот ${sp.spread_number} · ${sp.stage} (${labelOf(res)})`);
      }
      acc.push(backPage);
      setPages([...acc]);
      setLatest(backPage);
      const apiDrawn = acc.filter((p) => p.imageSource && p.imageSource !== "demo").length;
      setSt(
        "spreads",
        apiDrawn === acc.length ? "done" : "warn",
        `через API: ${apiDrawn} из ${acc.length}` + (apiDrawn < acc.length ? " — причина в красном плашке" : "")
      );

      /* 6 — вёрстка */
      setSt("layout", "active");
      await delay(480);
      if (cancelled()) return;
      setSt("layout", "done", "баннер 17% · Nunito 800 · палитра акцентом");
      addLog("Layout: текстовые баннеры наложены на каждый разворот");

      /* 7 — сборка */
      setSt("assemble", "active");
      addLog("Export: собираю документ — обложка → развороты → задняя обложка");
      await delay(560);
      if (cancelled()) return;
      setSt("assemble", "done", `${acc.length} ${plural(acc.length, "страница", "страницы", "страниц")} · квадрат 210×210 мм`);
      addLog("Export: готово. Листайте книгу скроллом, PDF — по кнопке.");

      const countSource = (s: string) => acc.filter((p) => p.imageSource === s).length;
      const geminiDrawn = countSource("gemini");
      const yandexDrawn = countSource("yandex-art");
      const hfDrawn = countSource("huggingface");
      const polDrawn = countSource("pollinations");
      const generated: GeneratedBook = {
        input: inp, story, pages: acc, engine, moderated: report, seed: activeSeed,
        imageReport: {
          gemini: geminiDrawn,
          yandex: yandexDrawn,
          hf: hfDrawn,
          pollinations: polDrawn,
          demo: acc.length - geminiDrawn - yandexDrawn - hfDrawn - polDrawn,
          firstError: firstErr,
        },
      };
      console.log("[GeneratedBook]", generated);
      setBook(generated);
      setPhase("book");
      setGenerating(false);
      toast("ok", "Книга готова — приятного чтения!");
    },
    [keys, draft.childPhotos, draft.companionPhotos, toast, connMode]
  );

  /* ── скачивание PDF ───────────────────────────────────────────────────── */
  const handleDownload = useCallback(async () => {
    if (!book) return;
    setExporting({ done: 0, total: book.pages.length });
    try {
      const blob = await exportBookPdf(book, getPalette(book.input.palette_id), (d, t) => setExporting({ done: d, total: t }));
      const name = pdfFileName(book.story.title);
      const kb = Math.max(1, Math.round(blob.size / 1024));
      console.info(`[Export] PDF собран: ${blob.size} байт (${kb} КБ), страниц: ${book.pages.length}, MIME: ${blob.type}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPdfInfo({ name, kb, pages: book.pages.length });
      toast("ok", `PDF сохранён: ${kb.toLocaleString("ru-RU")} КБ · ${book.pages.length} стр.`);
    } catch (e) {
      console.error("[Export] сбой сборки PDF:", e);
      toast("err", "Не удалось собрать PDF — детали в консоли");
    } finally {
      setExporting(null);
    }
  }, [book, toast]);

  const st = stepState(step);
  const connMeta: Record<ConnMode | "checking", { label: string; title: string; pill: string; dot: string }> = {
    checking: {
      label: "проверяю Yandex…",
      title: "Ищу локальный прокси на localhost:3001 (GET /api/yandex/status)",
      pill: "bg-foam text-ink/50",
      dot: "bg-ink/30",
    },
    backend: {
      label: "Yandex настроен на сервере",
      title: "YandexGPT и YandexART идут через прокси (npm --prefix server run server) — ключ в серверном .env, в браузер не попадает",
      pill: "bg-pine text-marigold",
      dot: "bg-marigold",
    },
    off: {
      label: "Yandex не настроен",
      title: "Прокси не запущен или ключ не задан: история — локальный движок, картинки — Gemini/HF/Pollinations. Запустите npm --prefix server run server",
      pill: "bg-paper text-ink/60",
      dot: "bg-ink/30",
    },
  };

  const ambient = (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-marigold/20 blur-2xl" />
      <div className="absolute -left-28 top-1/3 h-80 w-80 rounded-full bg-sea/15 blur-2xl" />
      <IconStar className="animate-float absolute left-[8%] top-[14%] h-8 w-8 text-marigold/70" style={{ ["--tilt" as string]: "12deg" }} />
      <IconMoon className="animate-drift absolute right-[12%] top-[22%] h-9 w-9 text-sea/60" />
      <IconSparkle className="animate-float-slow absolute bottom-[18%] left-[14%] h-7 w-7 text-coral/60" />
      <IconSparkle className="animate-float absolute bottom-[30%] right-[8%] h-6 w-6 text-fern/70" style={{ ["--tilt" as string]: "-10deg" }} />
    </div>
  );

  return (
    <div className="relative min-h-screen">
      {ambient}
      <Toasts items={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-mist/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button className="flex items-center gap-2.5 text-left" onClick={() => { setPhase("survey"); setStep(0); }}>
            <span className="grid h-10 w-10 -rotate-6 place-items-center rounded-xl border-[2.5px] border-ink bg-coral text-paper shadow-block-sm">
              <IconBook className="h-5.5 w-5.5" />
            </span>
            <span>
              <span className="block font-display text-[17px] font-bold leading-none text-pine">Сказка про меня</span>
              <span className="mt-0.5 block text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ink/50">персональная книга · MVP</span>
            </span>
          </button>
          <div className="flex items-center gap-2.5">
            {phase === "survey" && (
              <span className="hidden rounded-lg border-2 border-ink/20 px-2.5 py-1 font-display text-[12px] font-bold text-ink/55 sm:block">
                глава {step + 1} / {CHAPTERS.length}
              </span>
            )}
            <span
              title={connMeta[connMode].title}
              className={cx(
                "animate-pop flex items-center gap-2 rounded-xl border-[2.5px] border-ink px-3 py-1.5 font-display text-[12px] font-bold shadow-block-sm",
                connMeta[connMode].pill
              )}
            >
              <i className={cx("h-2.5 w-2.5 rounded-full", connMeta[connMode].dot, connMode === "backend" && "animate-pulse-dot")} />
              <span className="hidden sm:inline">{connMeta[connMode].label}</span>
              <span className="sm:hidden">{connMode === "backend" ? "Yandex ✓" : connMode === "off" ? "демо" : "…"}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-8">
        {phase === "survey" && (
          <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <CoverPreview draft={draft} seed={seed} />
              <ol className="mt-7 hidden gap-1 lg:flex lg:flex-col">
                {CHAPTERS.map((c, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={c.label}>
                      <button
                        onClick={() => { if (i <= step) setStep(i); }}
                        disabled={i > step}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-all",
                          active ? "border-ink bg-marigold shadow-block-sm" : done ? "border-transparent hover:border-ink/30" : "border-transparent opacity-45"
                        )}
                      >
                        <span className={cx(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-[12px] font-bold",
                          active ? "bg-pine text-marigold" : done ? "bg-fern text-paper" : "bg-paper text-ink/50"
                        )}>
                          {done ? <IconCheck className="h-3.5 w-3.5" strokeWidth={3.2} /> : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={cx("block font-display text-[13.5px] font-bold leading-tight", active ? "text-pine" : "text-ink/70")}>{c.label}</span>
                          <span className="block text-[10.5px] font-bold uppercase tracking-wider text-ink/40">{c.hint}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5">
                <ApiTestPanel />
              </div>
            </aside>

            <section key={step} className="card-paper step-enter h-fit p-6 sm:p-8">
              {step === 0 && <PhotoStep draft={draft} patch={patch} toast={toast} />}
              {step === 1 && <ChildStep draft={draft} patch={patch} toast={toast} />}
              {step === 2 && <GenreStep draft={draft} patch={patch} toast={toast} />}
              {step === 3 && <CountStep draft={draft} patch={patch} toast={toast} />}
              {step === 4 && <ThemeStep draft={draft} patch={patch} toast={toast} />}
              {step === 5 && <CompanionStep draft={draft} patch={patch} toast={toast} />}
              {step === 6 && <PaletteStep draft={draft} patch={patch} toast={toast} />}
              {step === 7 && <ExtrasStep draft={draft} patch={patch} toast={toast} />}
              {step === 8 && input ? (
                <ConfirmStep
                  input={input}
                  busy={generating}
                  onGenerate={() => {
                    setSeed((s) => s + 1);
                    void runPipeline(input, seed + 1);
                  }}
                />
              ) : (
                <div className="animate-pop rounded-xl border-2 border-coral bg-coral/10 p-4">
                  <p className="font-display text-[15px] font-bold text-coral">Черновик неполный — вернитесь на шаг «Герой» и заполните имя.</p>
                  <ChunkyButton variant="ghost" className="mt-3" onClick={() => setStep(1)}>К шагу 2</ChunkyButton>
                </div>
              )}
              {step < 8 && (
                <StepNav
                  onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
                  onNext={() => setStep((s) => s + 1)}
                  canNext={st.canNext}
                  hint={st.hint}
                />
              )}
            </section>
          </div>
        )}

        {phase === "progress" && (
          <ProgressScreen
            steps={pipeSteps}
            log={log}
            latest={latest}
            palette={palette}
            geminiError={geminiError}
            title={draft.name.trim() ? `Книга для ${draft.name.trim()}` : "Печатаем книгу"}
            onCancel={() => {
              runToken.current++;
              setGenerating(false);
              setPhase("survey");
              setStep(8);
              toast("warn", "Генерация отменена — черновик сохранён");
            }}
          />
        )}

        {phase === "book" && book && (
          <BookScreen
            book={book}
            palette={getPalette(book.input.palette_id)}
            onDownload={() => void handleDownload()}
            exporting={exporting}
            lastPdf={pdfInfo}
            onNewBook={() => {
              runToken.current++;
              setDraft(emptyDraft());
              setSeed((s) => s + 1);
              setBook(null);
              setPhase("survey");
              setStep(0);
            }}
            onRegenerate={() => {
              if (!book) return;
              const s = book.seed + 1;
              setSeed(s);
              void runPipeline(book.input, s);
            }}
          />
        )}
      </main>

      <footer className="relative z-10 border-t-[3px] border-ink bg-foam/80 py-5">
        <p className="mx-auto max-w-6xl px-4 text-center text-[12px] font-bold text-ink/50">
          MVP-пайплайн: Survey → Narrative → Safety → Reference → Cover → Illustration (Gemini → Hugging Face → демо) → Layout → Export ·
          ключи читаются из настроек и никогда не вшиты в код
        </p>
      </footer>
    </div>
  );
}
