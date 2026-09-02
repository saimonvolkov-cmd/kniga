import { PDFDocument } from "pdf-lib";
import type { GeneratedBook, GeneratedPage } from "../types";
import type { Palette } from "../data/content";
import { loadImage, rasterizeSvg, wrapTextLines } from "./utils";

/* ── Export Module ─────────────────────────────────────────────────────────
   Каждая страница — отдельный квадратный лист (≈210×210 мм): изображение на
   всю страницу + текстовый баннер (для разворотов), на обложке заголовок —
   отдельным дизайн-элементом поверх сцены. Кириллица рендерится канвасом,
   поэтому в PDF не нужно встраивать шрифты. */

const PAGE = 595.28;
const PX = 1080;

async function ensureFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load('700 90px "Comfortaa"'),
    document.fonts.load('800 42px "Nunito"'),
    document.fonts.load('700 52px "Caveat"'),
  ]).catch(() => undefined);
  await document.fonts.ready.catch(() => undefined);
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = wrapTextLines(ctx, text, maxWidth);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
  return lines.length;
}

function pageCanvas(page: GeneratedPage, book: GeneratedBook, palette: Palette): Promise<HTMLCanvasElement> {
  const [INK, , , , PAPER, WARM] = palette.colors;
  return (async () => {
    let source: HTMLCanvasElement;
    if (page.image.startsWith("<svg") || page.image.startsWith("<?xml")) {
      source = await rasterizeSvg(page.image, PX);
    } else {
      const img = await loadImage(page.image);
      const c = document.createElement("canvas");
      c.width = PX;
      c.height = PX;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0, PX, PX);
      source = c;
    }
    const ctx = source.getContext("2d")!;

    if (page.kind === "cover") {
      // заголовок — отдельный дизайн-элемент, не баннер
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '700 84px "Comfortaa"';
      const lines = wrapTextLines(ctx, book.story.title, PX - 200);
      const topY = 150;
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      const bh = lines.length * 104 + 84;
      ctx.roundRect(90, topY - 70, PX - 180, bh, 36);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 10;
      ctx.strokeStyle = INK;
      ctx.fillStyle = PAPER;
      lines.forEach((l, i) => {
        ctx.strokeText(l, PX / 2, topY + 20 + i * 104);
        ctx.fillText(l, PX / 2, topY + 20 + i * 104);
      });
      ctx.font = '700 54px "Caveat"';
      ctx.fillStyle = WARM;
      ctx.fillText(`история для ${book.input.child.name}`, PX / 2, topY + 20 + lines.length * 104 + 16);
    } else if (page.kind === "spread" && page.spread) {
      // полупрозрачный баннер ~17% высоты снизу
      const bannerH = Math.round(PX * 0.175);
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = WARM;
      ctx.fillRect(0, PX - bannerH, PX, bannerH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
      ctx.fillRect(0, PX - bannerH, PX, 6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '800 42px "Nunito"';
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 7;
      const lines = wrapTextLines(ctx, page.spread.text, PX - 130);
      const lh = 54;
      const startY = PX - bannerH / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => {
        ctx.strokeText(l, PX / 2, startY + i * lh);
        ctx.fillText(l, PX / 2, startY + i * lh);
      });
      // номер разворота уголком над баннером
      ctx.font = '700 30px "Comfortaa"';
      ctx.textAlign = "right";
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = PAPER;
      ctx.fillText(`${page.spread.spread_number} / ${book.input.spread_count}`, PX - 34, PX - bannerH - 26);
      ctx.globalAlpha = 1;
    } else {
      // задняя обложка: blurb + посвящение
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '800 40px "Nunito"';
      ctx.fillStyle = PAPER;
      drawWrapped(ctx, book.story.back_cover.blurb_text, PX / 2, 470, 420, 56);
      ctx.font = '700 56px "Caveat"';
      ctx.fillStyle = WARM;
      ctx.fillText(`${book.input.child.name} — главный герой этой книги`, PX / 2, 640);
      ctx.font = '600 26px "Nunito"';
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = PAPER;
      ctx.fillText("Сделано с любовью · Сказка про меня", PX / 2, PX - 96);
      ctx.globalAlpha = 1;
    }
    return source;
  })();
}

export async function exportBookPdf(
  book: GeneratedBook,
  palette: Palette,
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  await ensureFonts();
  const pdf = await PDFDocument.create();
  pdf.setTitle(book.story.title);
  pdf.setAuthor("Сказка про меня");
  pdf.setSubject(`Персональная книга для ${book.input.child.name}`);

  const total = book.pages.length;
  for (let i = 0; i < total; i++) {
    const canvas = await pageCanvas(book.pages[i], book, palette);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const jpg = await pdf.embedJpg(bytes);
    const page = pdf.addPage([PAGE, PAGE]);
    page.drawImage(jpg, { x: 0, y: 0, width: PAGE, height: PAGE });
    onProgress?.(i + 1, total);
  }
  const out = await pdf.save();
  return new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" });
}

export function pdfFileName(title: string): string {
  const safe = title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${safe || "skazka"}.pdf`;
}
