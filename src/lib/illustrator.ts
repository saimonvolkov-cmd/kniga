import type { BookInput, CompanionKind, Gender, Genre, Spread, Stage } from "../types";
import type { Palette } from "../data/content";
import { ILLUSTRATION_NEGATIVE, ILLUSTRATION_POSITIVE } from "../data/content";
import type { FocalId } from "./storyEngine";
import { hashString, mulberry32, pick } from "./utils";

/* ── Illustration Module (демо-движок) ─────────────────────────────────────
   Рисует «рукотворную» книжную сцену 1080×1080 как self-contained SVG.
   Правила из ТЗ соблюдены: персонаж никогда не смотрит в камеру — зрачки и
   корпус направлены на объект действия; фон заполнен; палитра приглушённая. */

export interface SceneSpec {
  genre: Genre;
  palette: Palette;
  seed: number;
  gender: Gender;
  companionKind: CompanionKind | null;
  stage: Stage;
  emotion: string;
  focal: FocalId;
  spreadNumber: number;
  isCover?: boolean;
}

const GENRE_FOCALS: Record<Genre, FocalId[]> = {
  forest: ["mushroom", "lantern", "butterfly", "bird", "flower", "kite"],
  space: ["star", "comet", "planet", "moon", "kite"],
  fairy_tale: ["bell", "key", "moon", "mushroom", "cloud", "flower"],
  underwater: ["pearl", "fish", "cloud", "flower", "kite"],
  pirates: ["map", "lighthouse", "chest", "bird", "cloud", "kite"],
  superhero: ["star", "cloud", "kite", "bell", "lantern", "bird"],
};

export function focalForSpread(genre: Genre, spread: Spread): FocalId {
  const pool = GENRE_FOCALS[genre];
  if (spread.stage === "climax") return spread.spread_number % 2 === 0 ? "lantern" : "star";
  if (spread.stage === "ordinary_world") return spread.spread_number === 1 ? "cloud" : "bird";
  return pool[hashString(spread.scene_description) % pool.length];
}

const R = (v: number) => Math.round(v * 10) / 10;
const SKIN = "#f6c49e";

function scatter(rnd: () => number, count: number, x0: number, y0: number, x1: number, y1: number) {
  return Array.from({ length: count }, () => ({
    x: R(x0 + rnd() * (x1 - x0)),
    y: R(y0 + rnd() * (y1 - y0)),
    r: R(1.2 + rnd() * 2.6),
    o: R(0.25 + rnd() * 0.7),
  }));
}

function environment(g: Genre, rnd: () => number, P: Palette["colors"], dark: boolean): string {
  const [, DEEP, MID, LIGHT, PAPER, WARM, COOL] = P;
  const s: string[] = [];
  switch (g) {
    case "forest": {
      s.push(`<ellipse cx="170" cy="640" rx="330" ry="180" fill="${MID}" opacity="0.55"/>`);
      s.push(`<ellipse cx="920" cy="660" rx="360" ry="190" fill="${MID}" opacity="0.4"/>`);
      for (const t of scatter(rnd, 9, 30, 470, 1050, 640)) {
        const h = 90 + rnd() * 90;
        s.push(
          `<g transform="translate(${t.x} ${t.y})"><rect x="-5" y="-12" width="10" height="26" fill="${P[0]}" opacity="0.8"/>` +
          `<path d="M0 ${-h} L${26 + h * 0.16} 0 L${-(26 + h * 0.16)} 0 Z" fill="${DEEP}"/>` +
          `<path d="M0 ${-h * 0.72} L${20 + h * 0.12} ${-h * 0.08} L${-(20 + h * 0.12)} ${-h * 0.08} Z" fill="${dark ? DEEP : MID}"/></g>`
        );
      }
      scatter(rnd, 12, 60, 300, 1020, 560).forEach((f) =>
        s.push(`<circle cx="${f.x}" cy="${f.y}" r="${R(f.r * 0.9)}" fill="${WARM}" opacity="${dark ? 0.9 : 0.5}"/>`)
      );
      break;
    }
    case "space": {
      s.push(
        scatter(rnd, 60, 0, 0, 1080, 1080).map((st) => `<circle cx="${st.x}" cy="${st.y}" r="${st.r}" fill="${PAPER}" opacity="${st.o}"/>`).join("")
      );
      s.push(`<ellipse cx="540" cy="520" rx="520" ry="110" fill="${LIGHT}" opacity="0.1" transform="rotate(-18 540 520)"/>`);
      s.push(
        `<circle cx="850" cy="210" r="86" fill="${COOL}" opacity="0.9"/>` +
        `<ellipse cx="850" cy="210" rx="150" ry="34" fill="none" stroke="${PAPER}" stroke-width="7" opacity="0.65" transform="rotate(-14 850 210)"/>` +
        `<circle cx="818" cy="188" r="14" fill="${PAPER}" opacity="0.5"/>`
      );
      s.push(
        `<g transform="translate(190 240) rotate(38)"><path d="M0 -46 Q26 -8 10 40 L-10 40 Q-26 -8 0 -46 Z" fill="${PAPER}"/>` +
        `<circle cx="0" cy="-6" r="10" fill="${COOL}"/><path d="M-10 40 L-22 62 L-4 52 Z" fill="${WARM}"/><path d="M10 40 L22 62 L4 52 Z" fill="${WARM}"/>` +
        `<path d="M-5 62 Q0 88 5 62 Q0 74 -5 62 Z" fill="${WARM}" opacity="0.9"/></g>`
      );
      break;
    }
    case "fairy_tale": {
      s.push(`<circle cx="880" cy="170" r="66" fill="${PAPER}" opacity="${dark ? 0.95 : 0.85}"/>`);
      if (dark) s.push(`<circle cx="856" cy="152" r="60" fill="${DEEP}"/>`);
      s.push(`<ellipse cx="250" cy="690" rx="420" ry="210" fill="${MID}" opacity="0.5"/>`);
      s.push(`<ellipse cx="900" cy="700" rx="420" ry="220" fill="${MID}" opacity="0.42"/>`);
      s.push(
        `<g transform="translate(802 430)"><rect x="-34" y="0" width="68" height="150" fill="${LIGHT}"/>` +
        `<path d="M-46 0 L0 -78 L46 0 Z" fill="${COOL}"/><rect x="-10" y="36" width="20" height="30" rx="9" fill="${P[0]}" opacity="0.75"/>` +
        `<line x1="0" y1="-78" x2="0" y2="-106" stroke="${P[0]}" stroke-width="4"/><path d="M0 -106 L30 -98 L0 -88 Z" fill="${WARM}"/></g>`
      );
      s.push(`<path d="M-20 1010 Q260 850 420 880 T780 830 T1120 780" fill="none" stroke="${PAPER}" stroke-width="26" opacity="0.5" stroke-linecap="round"/>`);
      scatter(rnd, 8, 80, 760, 1000, 850).forEach((f) =>
        s.push(`<g transform="translate(${f.x} ${f.y})"><rect x="-3" y="-14" width="6" height="14" fill="${PAPER}" opacity="0.85"/><path d="M-14 -14 Q0 -34 14 -14 Z" fill="${WARM}"/></g>`)
      );
      break;
    }
    case "underwater": {
      s.push(`<polygon points="300,-10 420,-10 760,1090 560,1090" fill="${PAPER}" opacity="0.08"/>`);
      s.push(`<polygon points="560,-10 640,-10 1000,1090 860,1090" fill="${PAPER}" opacity="0.06"/>`);
      for (let i = 0; i < 6; i++) {
        const x = 90 + i * 170 + rnd() * 60;
        s.push(
          `<path d="M${R(x)} 1090 Q ${R(x - 40)} ${R(860 - rnd() * 120)} ${R(x + 16)} ${R(680 - rnd() * 140)} T ${R(x - 10)} ${R(420 - rnd() * 80)}" fill="none" stroke="${MID}" stroke-width="${R(10 + rnd() * 10)}" stroke-linecap="round" opacity="0.85"/>`
        );
      }
      scatter(rnd, 16, 60, 120, 1020, 800).forEach((b) =>
        s.push(`<circle cx="${b.x}" cy="${b.y}" r="${R(3 + b.r * 2.4)}" fill="none" stroke="${PAPER}" stroke-width="3" opacity="${R(b.o * 0.6)}"/>`)
      );
      scatter(rnd, 7, 500, 200, 980, 520).forEach((f) =>
        s.push(`<g transform="translate(${f.x} ${f.y}) rotate(${R(-14 + rnd() * 28)})"><path d="M0 0 Q14 -10 28 0 Q14 10 0 0 Z" fill="${COOL}"/><path d="M-10 0 L0 -7 L0 7 Z" fill="${COOL}"/></g>`)
      );
      break;
    }
    case "pirates": {
      s.push(`<circle cx="180" cy="180" r="70" fill="${WARM}" opacity="0.9"/><circle cx="180" cy="180" r="92" fill="${WARM}" opacity="0.22"/>`);
      scatter(rnd, 4, 300, 80, 1000, 260).forEach((c) =>
        s.push(`<g transform="translate(${c.x} ${c.y})"><ellipse rx="74" ry="24" fill="${PAPER}" opacity="0.85"/><ellipse cx="46" cy="10" rx="48" ry="18" fill="${PAPER}" opacity="0.7"/></g>`)
      );
      s.push(`<rect x="0" y="560" width="1080" height="520" fill="${DEEP}"/>`);
      for (let i = 0; i < 6; i++) {
        const y = 600 + i * 74;
        s.push(`<path d="M-20 ${y} Q 120 ${y - 22} 260 ${y} T 540 ${y} T 820 ${y} T 1100 ${y}" fill="none" stroke="${MID}" stroke-width="9" opacity="${R(0.65 - i * 0.08)}"/>`);
      }
      s.push(
        `<g transform="translate(820 512)"><path d="M-64 0 Q0 30 64 0 L46 -6 L-46 -6 Z" fill="${P[0]}"/>` +
        `<line x1="0" y1="-6" x2="0" y2="-86" stroke="${P[0]}" stroke-width="6"/><path d="M0 -86 Q44 -74 6 -40 L0 -40 Z" fill="${PAPER}" opacity="0.9"/></g>`
      );
      s.push(`<path d="M300 300 q14 -14 28 0 q14 -14 28 0" fill="none" stroke="${P[0]}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`);
      break;
    }
    case "superhero": {
      if (dark) s.push(scatter(rnd, 40, 0, 0, 1080, 420).map((st) => `<circle cx="${st.x}" cy="${st.y}" r="${st.r}" fill="${PAPER}" opacity="${st.o}"/>`).join(""));
      let x = -30;
      for (const b of scatter(rnd, 9, 20, 0, 1060, 40)) {
        const w = 90 + b.r * 34;
        const h = 240 + rnd() * 320;
        s.push(`<rect x="${R(x)}" y="${R(620 - h)}" width="${R(w)}" height="${R(h)}" fill="${dark ? P[0] : MID}" opacity="${dark ? 0.95 : 0.85}"/>`);
        for (let wy = 620 - h + 26; wy < 600; wy += 52)
          for (let wx = x + 16; wx < x + w - 22; wx += 40)
            if (rnd() > 0.42)
              s.push(`<rect x="${R(wx)}" y="${R(wy)}" width="16" height="22" fill="${dark ? WARM : PAPER}" opacity="${R(0.55 + rnd() * 0.4)}"/>`);
        x += w + 26 + rnd() * 60;
      }
      s.push(
        `<g transform="translate(250 180)"><ellipse rx="80" ry="26" fill="${PAPER}" opacity="0.9"/><ellipse cx="52" cy="10" rx="52" ry="20" fill="${PAPER}" opacity="0.75"/></g>` +
        `<g transform="translate(800 130)"><ellipse rx="64" ry="22" fill="${PAPER}" opacity="0.8"/></g>`
      );
      s.push(`<rect x="0" y="620" width="1080" height="460" fill="${dark ? P[0] : DEEP}"/>`);
      break;
    }
  }
  return s.join("");
}

function groundBand(g: Genre, P: Palette["colors"]): string {
  const [, DEEP, , , , WARM, COOL] = P;
  const bumps: string[] = [];
  let x = -20;
  while (x < 1120) {
    const w = 90 + Math.sin(x) * 40;
    bumps.push(`Q ${R(x + w / 2)} ${R(858 + Math.sin(x * 0.7) * 10)} ${R(x + w)} 884`);
    x += w;
  }
  const deco: string[] = [];
  if (g === "underwater") {
    for (let i = 0; i < 7; i++)
      deco.push(`<path d="M${80 + i * 150} 1080 q14 -40 0 -74 q-14 -34 4 -60" fill="none" stroke="${COOL}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>`);
  } else if (g === "space") {
    for (let i = 0; i < 8; i++)
      deco.push(`<circle cx="${60 + i * 135}" cy="${950 + ((i * 37) % 90)}" r="${8 + ((i * 13) % 12)}" fill="${DEEP}" opacity="0.9"/>`);
  } else {
    for (let i = 0; i < 10; i++)
      deco.push(`<path d="M${40 + i * 108} 960 q6 -34 0 -52 M${58 + i * 108} 964 q10 -28 4 -48" fill="none" stroke="${WARM}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>`);
  }
  return `<path d="M-20 884 ${bumps.join(" ")} L1120 1100 L-20 1100 Z" fill="${g === "space" ? P[0] : DEEP}"/>` + deco.join("");
}

function focalObject(id: FocalId, x: number, y: number, P: Palette["colors"]): string {
  const [, , , LIGHT, PAPER, WARM, COOL] = P;
  const glow = `<circle cx="${x}" cy="${y}" r="120" fill="${WARM}" opacity="0.16"/><circle cx="${x}" cy="${y}" r="70" fill="${WARM}" opacity="0.2"/>`;
  let body = "";
  switch (id) {
    case "star":
      body = `<path d="M0 -52 L14 -16 L52 -12 L22 12 L32 50 L0 28 L-32 50 L-22 12 L-52 -12 L-14 -16 Z" fill="${WARM}" stroke="${PAPER}" stroke-width="4"/>`;
      break;
    case "comet":
      body = `<path d="M-130 -60 Q-40 -30 10 -6 Q-30 16 -128 44 Q-60 4 -130 -60 Z" fill="${LIGHT}" opacity="0.75"/><circle r="30" fill="${PAPER}"/><circle r="30" fill="none" stroke="${WARM}" stroke-width="6" opacity="0.8"/>`;
      break;
    case "planet":
      body = `<circle r="46" fill="${COOL}"/><ellipse rx="78" ry="16" fill="none" stroke="${PAPER}" stroke-width="7" transform="rotate(-16)"/><circle cx="-14" cy="-10" r="9" fill="${PAPER}" opacity="0.6"/>`;
      break;
    case "moon":
      body = `<circle r="44" fill="${PAPER}"/><path d="M14 -44 A44 44 0 1 0 44 12 A34 34 0 1 1 14 -44 Z" fill="${WARM}" opacity="0.9"/>`;
      break;
    case "lantern":
      body = `<rect x="-24" y="-34" width="48" height="64" rx="14" fill="${WARM}" stroke="${PAPER}" stroke-width="5"/><rect x="-14" y="-46" width="28" height="14" rx="6" fill="${PAPER}"/><circle r="12" fill="${PAPER}" opacity="0.95"/><line x1="0" y1="-46" x2="0" y2="-70" stroke="${PAPER}" stroke-width="5" stroke-linecap="round"/>`;
      break;
    case "butterfly":
      body = `<path d="M0 0 Q-46 -40 -56 -8 Q-60 22 -8 12 Z" fill="${COOL}"/><path d="M0 0 Q46 -40 56 -8 Q60 22 8 12 Z" fill="${WARM}"/><ellipse rx="5" ry="16" fill="${PAPER}"/>`;
      break;
    case "mushroom":
      body = `<rect x="-11" y="-6" width="22" height="40" rx="9" fill="${PAPER}"/><path d="M-42 -4 Q0 -58 42 -4 Z" fill="${WARM}"/><circle cx="-14" cy="-22" r="6" fill="${PAPER}"/><circle cx="12" cy="-30" r="5" fill="${PAPER}"/>`;
      break;
    case "flower":
      for (let i = 0; i < 6; i++) body += `<ellipse cx="0" cy="-26" rx="13" ry="26" fill="${COOL}" transform="rotate(${i * 60})"/>`;
      body += `<circle r="14" fill="${WARM}"/>`;
      break;
    case "pearl":
      body = `<path d="M-44 18 Q0 -30 44 18 Q0 4 -44 18 Z" fill="${COOL}"/><circle cy="-4" r="20" fill="${PAPER}"/><circle cx="-6" cy="-10" r="6" fill="${LIGHT}"/>`;
      break;
    case "fish":
      body = `<path d="M-34 0 Q0 -26 30 0 Q0 26 -34 0 Z" fill="${COOL}"/><path d="M-34 0 L-52 -14 L-52 14 Z" fill="${COOL}"/><circle cx="16" cy="-5" r="4" fill="${PAPER}"/>`;
      break;
    case "chest":
      body = `<rect x="-36" y="-20" width="72" height="44" rx="8" fill="${WARM}" stroke="${PAPER}" stroke-width="5"/><path d="M-36 -20 Q0 -44 36 -20 Z" fill="${COOL}" stroke="${PAPER}" stroke-width="5"/><circle r="7" fill="${PAPER}"/>`;
      break;
    case "map":
      body = `<rect x="-40" y="-26" width="80" height="52" rx="6" fill="${PAPER}"/><path d="M-26 -12 Q-8 2 4 -10 T30 4" fill="none" stroke="${COOL}" stroke-width="5" stroke-dasharray="2 8" stroke-linecap="round"/><path d="M24 10 l10 10 M34 10 l-10 10" stroke="${WARM}" stroke-width="5" stroke-linecap="round"/><circle cx="-40" cy="0" r="9" fill="${COOL}"/><circle cx="40" cy="0" r="9" fill="${COOL}"/>`;
      break;
    case "cloud":
      body = `<ellipse rx="54" ry="26" fill="${PAPER}"/><ellipse cx="-34" cy="8" rx="30" ry="18" fill="${PAPER}"/><ellipse cx="36" cy="10" rx="30" ry="16" fill="${PAPER}"/>`;
      break;
    case "kite":
      body = `<path d="M0 -44 L32 0 L0 44 L-32 0 Z" fill="${COOL}" stroke="${PAPER}" stroke-width="5"/><path d="M0 44 Q18 74 4 104" fill="none" stroke="${PAPER}" stroke-width="4"/><path d="M-8 78 l16 8 M-2 98 l16 6" stroke="${WARM}" stroke-width="5" stroke-linecap="round"/>`;
      break;
    case "bird":
      body = `<ellipse rx="26" ry="18" fill="${PAPER}"/><circle cx="22" cy="-12" r="13" fill="${PAPER}"/><path d="M34 -12 l12 4 l-12 5 Z" fill="${WARM}"/><path d="M-8 -2 Q-28 -14 -20 4 Q-10 10 -8 -2 Z" fill="${COOL}"/>`;
      break;
    case "bell":
      body = `<path d="M-30 22 Q-34 -30 0 -36 Q34 -30 30 22 Z" fill="${WARM}" stroke="${PAPER}" stroke-width="5"/><circle cy="26" r="9" fill="${PAPER}"/><path d="M-12 -36 Q0 -52 12 -36" fill="none" stroke="${PAPER}" stroke-width="6" stroke-linecap="round"/>`;
      break;
    case "key":
      body = `<circle cx="0" cy="-24" r="20" fill="none" stroke="${WARM}" stroke-width="10"/><line x1="0" y1="-4" x2="0" y2="46" stroke="${WARM}" stroke-width="10" stroke-linecap="round"/><line x1="0" y1="34" x2="18" y2="34" stroke="${WARM}" stroke-width="9" stroke-linecap="round"/>`;
      break;
    case "lighthouse":
      body = `<path d="M-22 60 L-14 -34 L14 -34 L22 60 Z" fill="${PAPER}"/><rect x="-18" y="-52" width="36" height="20" rx="5" fill="${WARM}"/><path d="M-20 -52 L0 -74 L20 -52 Z" fill="${COOL}"/><path d="M-14 0 h28 M-17 26 h34" stroke="${COOL}" stroke-width="9"/><path d="M-24 -42 L-70 -54 M-24 -36 L-70 -28" stroke="${WARM}" stroke-width="6" stroke-linecap="round" opacity="0.9"/>`;
      break;
    case "dragon":
      body = `<ellipse rx="46" ry="30" fill="${COOL}"/><circle cx="38" cy="-18" r="18" fill="${COOL}"/><path d="M-30 -20 q-26 -22 -6 -34 q4 18 12 26 Z" fill="${LIGHT}"/><circle cx="44" cy="-22" r="4" fill="${PAPER}"/>`;
      break;
  }
  return `<g transform="translate(${x} ${y})">${glow}${body}</g>`;
}

function faceMouth(emotion: string, P: Palette["colors"]): string {
  const [INK] = P;
  const em = emotion.toLowerCase();
  if (/восторг|радость|счаст/.test(em)) return `<path d="M-13 0 Q0 16 13 0 Z" fill="${INK}"/>`;
  if (/удив/.test(em)) return `<circle r="6.5" fill="${INK}"/>`;
  if (/волн|растер|груст|досад/.test(em))
    return `<path d="M-11 4 Q-5 -2 0 3 Q6 -2 11 4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (/решим/.test(em)) return `<line x1="-10" y1="2" x2="10" y2="2" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `<path d="M-11 0 Q0 10 11 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
}

function childFigure(opts: {
  x: number; y: number; scale: number; gender: Gender; focalX: number; focalY: number;
  emotion: string; P: Palette["colors"];
}): string {
  const { x, y, scale: s, gender, focalX, focalY, emotion, P } = opts;
  const [INK, DEEP, MID, LIGHT, PAPER, WARM] = P;
  const dirX = focalX - x, dirY = focalY - (y - 150 * s);
  const len = Math.hypot(dirX, dirY) || 1;
  const px = (dirX / len) * 3.4, py = (dirY / len) * 3.4;
  const lean = Math.max(-7, Math.min(7, dirX / 90));
  const shX = dirX >= 0 ? 28 * s : -28 * s;
  const ang = Math.atan2(focalY - (y - 104 * s), focalX - (x + shX));
  const hx = shX + Math.cos(ang) * 74 * s, hy = -104 * s + Math.sin(ang) * 74 * s;
  const hair =
    gender === "male"
      ? `<path d="M-46 -152 Q-50 -206 0 -208 Q50 -206 46 -152 Q30 -186 6 -182 Q-24 -198 -46 -152 Z" fill="${DEEP}"/>`
      : `<path d="M-50 -150 Q-54 -210 0 -210 Q54 -210 50 -150 L50 -128 Q44 -150 34 -158 Q10 -178 -34 -158 Q-44 -150 -50 -128 Z" fill="${DEEP}"/><circle cx="34" cy="-176" r="9" fill="${WARM}"/>`;
  const eyes = [-15, 15]
    .map((ex) => `<ellipse cx="${ex}" cy="-156" rx="7" ry="8" fill="${PAPER}"/><circle cx="${R(ex + px)}" cy="${R(-156 + py)}" r="3.6" fill="${INK}"/>`)
    .join("");
  return (
    `<g transform="translate(${x} ${y}) rotate(${R(lean)}) scale(${s})">` +
    `<path d="M-13 -44 L-24 -4" stroke="${MID}" stroke-width="20" stroke-linecap="round"/>` +
    `<path d="M13 -44 L30 -8" stroke="${MID}" stroke-width="20" stroke-linecap="round"/>` +
    `<ellipse cx="-27" cy="0" rx="15" ry="9" fill="${INK}"/><ellipse cx="33" cy="-4" rx="15" ry="9" fill="${INK}"/>` +
    `<rect x="-34" y="-118" width="68" height="80" rx="24" fill="${MID}"/>` +
    `<path d="M-34 -96 L34 -96 L34 -62 Q0 -46 -34 -62 Z" fill="${DEEP}" opacity="0.55"/>` +
    `<line x1="-20" y1="-118" x2="-20" y2="-100" stroke="${DEEP}" stroke-width="7" stroke-linecap="round"/>` +
    `<line x1="20" y1="-118" x2="20" y2="-100" stroke="${DEEP}" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cy="-84" r="5" fill="${WARM}"/>` +
    `<path d="M${-shX} -104 q${dirX >= 0 ? -16 : 16} 26 ${dirX >= 0 ? -10 : 10} 46" fill="none" stroke="${LIGHT}" stroke-width="17" stroke-linecap="round"/>` +
    `<circle cx="${R(-shX + (dirX >= 0 ? -10 : 10))}" cy="-56" r="9" fill="${SKIN}"/>` +
    `<path d="M${R(shX)} -104 L${R(hx)} ${R(hy)}" stroke="${LIGHT}" stroke-width="17" stroke-linecap="round"/>` +
    `<circle cx="${R(hx)}" cy="${R(hy)}" r="10" fill="${SKIN}"/>` +
    `<circle cy="-150" r="47" fill="${SKIN}"/>` + hair +
    `<circle cx="-27" cy="-141" r="7.5" fill="${WARM}" opacity="0.55"/><circle cx="27" cy="-141" r="7.5" fill="${WARM}" opacity="0.55"/>` +
    eyes + `<g transform="translate(0 -135)">${faceMouth(emotion, P)}</g>` +
    `</g>`
  );
}

function companionFigure(kind: CompanionKind, x: number, y: number, s: number, focalX: number, focalY: number, P: Palette["colors"]): string {
  const [, DEEP, , LIGHT, PAPER, WARM, COOL] = P;
  const px = focalX - x >= 0 ? 3 : -3;
  const eyes = (ex: number, ey: number) =>
    `<circle cx="${ex - 7}" cy="${ey}" r="5.4" fill="${PAPER}"/><circle cx="${ex + 7}" cy="${ey}" r="5.4" fill="${PAPER}"/>` +
    `<circle cx="${R(ex - 7 + px)}" cy="${ey}" r="2.6" fill="${DEEP}"/><circle cx="${R(ex + 7 + px)}" cy="${ey}" r="2.6" fill="${DEEP}"/>`;
  let body = "";
  switch (kind) {
    case "cat":
      body = `<ellipse cy="-34" rx="30" ry="26" fill="${WARM}"/><circle cy="-72" r="22" fill="${WARM}"/><path d="M-18 -84 L-14 -102 L-2 -88 Z" fill="${WARM}"/><path d="M18 -84 L14 -102 L2 -88 Z" fill="${WARM}"/>${eyes(0, -74)}<path d="M-4 -64 Q0 -60 4 -64" fill="none" stroke="${DEEP}" stroke-width="2.6" stroke-linecap="round"/><path d="M28 -30 Q54 -44 50 -70" fill="none" stroke="${WARM}" stroke-width="9" stroke-linecap="round"/>`;
      break;
    case "dog":
      body = `<ellipse cy="-32" rx="30" ry="25" fill="${LIGHT}"/><circle cy="-70" r="22" fill="${LIGHT}"/><ellipse cx="-20" cy="-80" rx="9" ry="16" fill="${DEEP}" transform="rotate(18 -20 -80)"/><ellipse cx="20" cy="-80" rx="9" ry="16" fill="${DEEP}" transform="rotate(-18 20 -80)"/>${eyes(0, -72)}<ellipse cy="-58" rx="8" ry="6" fill="${DEEP}"/><path d="M-34 -22 Q-52 -30 -50 -48" fill="none" stroke="${LIGHT}" stroke-width="9" stroke-linecap="round"/>`;
      break;
    case "bunny":
      body = `<ellipse cy="-32" rx="27" ry="25" fill="${PAPER}"/><circle cy="-68" r="20" fill="${PAPER}"/><ellipse cx="-9" cy="-100" rx="7" ry="22" fill="${PAPER}"/><ellipse cx="9" cy="-100" rx="7" ry="22" fill="${PAPER}"/><ellipse cx="-9" cy="-100" rx="3" ry="14" fill="${WARM}" opacity="0.6"/><ellipse cx="9" cy="-100" rx="3" ry="14" fill="${WARM}" opacity="0.6"/>${eyes(0, -70)}<circle cy="-60" r="3.4" fill="${WARM}"/>`;
      break;
    case "bear":
      body = `<ellipse cy="-34" rx="30" ry="27" fill="${COOL}"/><circle cy="-74" r="23" fill="${COOL}"/><circle cx="-16" cy="-92" r="9" fill="${COOL}"/><circle cx="16" cy="-92" r="9" fill="${COOL}"/>${eyes(0, -76)}<ellipse cy="-64" rx="9" ry="7" fill="${PAPER}"/><circle cy="-66" r="3" fill="${DEEP}"/>`;
      break;
    case "robot":
      body = `<rect x="-24" y="-58" width="48" height="48" rx="10" fill="${COOL}"/><rect x="-19" y="-92" width="38" height="30" rx="8" fill="${LIGHT}"/><circle cx="-8" cy="-78" r="5" fill="${DEEP}"/><circle cx="8" cy="-78" r="5" fill="${DEEP}"/><line x1="0" y1="-92" x2="0" y2="-106" stroke="${COOL}" stroke-width="4"/><circle cy="-110" r="5" fill="${WARM}"/><rect x="-10" y="-46" width="20" height="12" rx="5" fill="${WARM}"/>`;
      break;
    case "fox":
      body = `<ellipse cy="-32" rx="28" ry="24" fill="${WARM}"/><circle cy="-68" r="21" fill="${WARM}"/><path d="M-18 -78 L-16 -98 L-4 -84 Z" fill="${WARM}"/><path d="M18 -78 L16 -98 L4 -84 Z" fill="${WARM}"/><ellipse cy="-58" rx="8" ry="6" fill="${PAPER}"/>${eyes(0, -72)}<path d="M30 -26 Q56 -34 58 -58 Q58 -36 44 -22 Q36 -16 30 -26 Z" fill="${WARM}"/>`;
      break;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
}

export function pickCompanionKind(input: BookInput, seed: number): CompanionKind | null {
  if (!input.companion.name) return null;
  const rnd = mulberry32(seed + 77);
  const petKinds: CompanionKind[] = ["cat", "dog", "bunny", "fox"];
  const toyKinds: CompanionKind[] = ["bear", "robot"];
  return pick(rnd, input.companion.type === "toy" ? toyKinds : petKinds);
}

/* ── сборка сцены ───────────────────────────────────────────────────────── */
export function renderScene(spec: SceneSpec): string {
  const rnd = mulberry32(spec.seed * 1000 + spec.spreadNumber * 17);
  const P = spec.palette.colors;
  const [, DEEP, , LIGHT] = P;
  const dark =
    spec.stage === "climax" || spec.stage === "trial"
      ? rnd() > 0.55
      : spec.stage === "return_lesson" && rnd() > 0.5;
  const night = spec.genre === "space" || dark;
  const skyTop = night ? P[0] : DEEP;
  const skyBot = night ? DEEP : spec.genre === "underwater" ? MID(P) : LIGHT;

  const childLeft = !spec.isCover && rnd() > 0.5;
  const cx = spec.isCover ? 430 : childLeft ? 360 : 720;
  const fx = spec.isCover ? 790 : childLeft ? 770 + rnd() * 60 : 310 - rnd() * 60;
  const fy = spec.isCover ? 300 : 250 + rnd() * 160;
  const cy = 900;

  const parts: string[] = [];
  parts.push(
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBot}"/></linearGradient>` +
    `<radialGradient id="vig" cx="0.5" cy="0.46" r="0.75"><stop offset="0.62" stop-color="${P[0]}" stop-opacity="0"/><stop offset="1" stop-color="${P[0]}" stop-opacity="0.34"/></radialGradient>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>`
  );
  parts.push(`<rect width="1080" height="1080" fill="url(#sky)"/>`);
  parts.push(environment(spec.genre, rnd, P, night));
  parts.push(groundBand(spec.genre, P));
  parts.push(focalObject(spec.focal, R(fx), R(fy), P));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    parts.push(
      `<circle cx="${R(fx + Math.cos(a) * (90 + rnd() * 50))}" cy="${R(fy + Math.sin(a) * (70 + rnd() * 40))}" r="${R(2.5 + rnd() * 3)}" fill="${P[4]}" opacity="${R(0.5 + rnd() * 0.4)}"/>`
    );
  }
  parts.push(childFigure({ x: cx, y: cy, scale: spec.isCover ? 1.28 : 1.06, gender: spec.gender, focalX: fx, focalY: fy, emotion: spec.emotion, P }));
  if (spec.companionKind) {
    const compX = childLeft ? cx + 168 : cx - 168;
    parts.push(companionFigure(spec.companionKind, compX, cy + 6, 0.92, fx, fy, P));
  }
  parts.push(`<rect width="1080" height="1080" filter="url(#grain)" opacity="0.05"/>`);
  parts.push(`<rect width="1080" height="1080" fill="url(#vig)"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">${parts.join("")}</svg>`;
}

/* хелпер — «средний» цвет для воды */
const MID = (P: Palette["colors"]) => P[2];

export function renderCoverScene(input: BookInput, palette: Palette, seed: number, kind: CompanionKind | null): string {
  const rnd = mulberry32(seed);
  return renderScene({
    genre: input.genre, palette, seed, gender: input.child.gender, companionKind: kind,
    stage: "call_to_adventure", emotion: "восторг",
    focal: pick(rnd, GENRE_FOCALS[input.genre]), spreadNumber: 0, isCover: true,
  });
}

export function renderBackScene(input: BookInput, palette: Palette, seed: number): string {
  const rnd = mulberry32(seed + 555);
  const P = palette.colors;
  const [INK, DEEP, , , PAPER, WARM] = P;
  const tiles: string[] = [];
  const icons = ["star", "moon", "cloud", "flower", "mushroom"] as FocalId[];
  for (let gy = 0; gy < 5; gy++)
    for (let gx = 0; gx < 5; gx++) {
      if ((gx + gy) % 2 === 0) continue;
      const id = icons[(gx * 3 + gy * 5 + seed) % icons.length];
      tiles.push(
        `<g transform="translate(${120 + gx * 210} ${120 + gy * 210}) rotate(${R(rnd() * 24 - 12)}) scale(0.62)" opacity="0.55">` +
        focalObject(id, 0, 0, P).replace(/translate\(([^)]+)\)/, "") + `</g>`
      );
    }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">` +
    `<defs><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>` +
    `<rect width="1080" height="1080" fill="${DEEP}"/>` + tiles.join("") +
    `<rect x="46" y="46" width="988" height="988" rx="34" fill="none" stroke="${PAPER}" stroke-width="5" opacity="0.85" stroke-dasharray="3 16" stroke-linecap="round"/>` +
    `<circle cx="540" cy="540" r="252" fill="${INK}" opacity="0.82"/><circle cx="540" cy="540" r="252" fill="none" stroke="${WARM}" stroke-width="6" opacity="0.9"/>` +
    `<rect width="1080" height="1080" filter="url(#grain)" opacity="0.05"/></svg>`
  );
}

/* ── промпт для реальных API-вызовов (референс-фото прикладывает api.ts) ── */
export function buildImagePrompt(input: BookInput, spread: Spread | null, palette: Palette, kind: "cover" | "back" | "spread"): string {
  const paletteLine = `Palette id "${palette.id}" — use these exact hex colors as accents: ${palette.colors.join(", ")}.`;
  const who =
    `Main character: a ${input.child.age_group} year old ${input.child.gender === "male" ? "boy" : "girl"} named ${input.child.name}` +
    (input.companion.name ? `, accompanied by their ${input.companion.type === "pet" ? "pet" : "toy"} ${input.companion.name} (see reference photo)` : "") + ". ";
  const scene = kind === "cover" ? "Book cover scene — iconic scene summarizing the whole story: " : "";
  const sceneText = spread?.scene_description ?? (kind === "back" ? "soft decorative ornament in the book palette, no complex action" : "");
  const gaze = spread?.gaze_direction ?? "toward the central action of the scene";
  return (
    `${who}Genre: ${input.genre}. ${scene}${sceneText} The character's gaze is directed ${gaze}. ` +
    paletteLine + " " + ILLUSTRATION_POSITIVE + ". " + ILLUSTRATION_NEGATIVE + "."
  );
}
