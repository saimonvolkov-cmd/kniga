import type { ReactNode, SVGProps } from "react";
import type { CompanionRole, CompanionType, Genre } from "../types";

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconCastle = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M5 21V9l-2-2V4h2v1.5h2V4h2v1.5h2V4h2v1.5h2V4h2v3l-2 2v12" />
    <path d="M3 21h18" />
    <path d="M10 21v-4a2 2 0 1 1 4 0v4" />
    <path d="M12 9v2" />
  </Svg>
);
export const IconRocket = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 2c3 2.5 4.5 6 4.5 9.5L12 16l-4.5-4.5C7.5 8 9 4.5 12 2Z" />
    <circle cx="12" cy="9" r="1.8" />
    <path d="M7.5 11.5 5 14l3 1M16.5 11.5 19 14l-3 1M12 16v3M9.5 21l2.5-2 2.5 2" />
  </Svg>
);
export const IconBolt = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />
  </Svg>
);
export const IconTree = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 2 6.5 9h2L5 14h4l-2.5 4h11L15 14h4l-3.5-5h2L12 2Z" />
    <path d="M12 18v4" />
  </Svg>
);
export const IconFish = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 12s3.5-5 9-5c4 0 7 2.5 9 5-2 2.5-5 5-9 5-5.5 0-9-5-9-5Z" />
    <circle cx="16" cy="11" r="1" fill="currentColor" />
    <path d="M3 12l-1-3M3 12l-1 3" />
  </Svg>
);
export const IconShip = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 15h16l-2.5 5h-11L4 15Z" />
    <path d="M12 15V4l6 8h-6" />
    <path d="M12 6 7 12h5" />
    <path d="M2 22c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
  </Svg>
);
export const IconDice = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="15.5" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconPaw = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="7" cy="8" r="2" />
    <circle cx="12" cy="6" r="2" />
    <circle cx="17" cy="8" r="2" />
    <path d="M12 11c-3 0-6 2.5-6 5.5 0 1.7 1.3 2.5 2.5 2.5 1.3 0 2.2-.8 3.5-.8s2.2.8 3.5.8c1.2 0 2.5-.8 2.5-2.5 0-3-3-5.5-6-5.5Z" />
  </Svg>
);
export const IconTeddy = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="7.5" cy="5.5" r="2.5" />
    <circle cx="16.5" cy="5.5" r="2.5" />
    <circle cx="12" cy="9" r="4.5" />
    <path d="M8 14c-2.5.8-4 2.7-4 5a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3c0-2.3-1.5-4.2-4-5" />
    <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 2 5 5v6c0 5 3 8.5 7 11 4-2.5 7-6 7-11V5l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const IconGrin = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7.5 13.5a5 5 0 0 0 9 0Z" />
    <path d="M9 9.2h.01M15 9.2h.01" strokeWidth={2.6} />
  </Svg>
);
export const IconBulb = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 1 3.7 10.7c-.8.6-1.2 1.4-1.2 2.3h-5c0-.9-.4-1.7-1.2-2.3A6 6 0 0 1 12 3Z" />
  </Svg>
);
export const IconMegaphone = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 11v3l4 1 11 5V4L7 10l-4 1Z" />
    <path d="M7 14v4a2 2 0 0 0 2 2h1" />
  </Svg>
);
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);
export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 8h2.5L9 5h6l2.5 3H20a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V9.5A1.5 1.5 0 0 1 4 8Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Svg>
);
export const IconArrowR = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 12h16M13 5l7 7-7 7" />
  </Svg>
);
export const IconArrowL = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M20 12H4M11 5l-7 7 7 7" />
  </Svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </Svg>
);
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3c.6 3.8 2.4 5.9 6.5 6.5-4.1.6-5.9 2.7-6.5 6.5-.6-3.8-2.4-5.9-6.5-6.5C9.6 8.9 11.4 6.8 12 3Z" />
    <path d="M19 15.5c.3 1.8 1.1 2.7 3 3-1.9.3-2.7 1.2-3 3-.3-1.8-1.1-2.7-3-3 1.9-.3 2.7-1.2 3-3Z" />
  </Svg>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 6c-1.8-1.6-4.4-2-8-2v14c3.6 0 6.2.4 8 2 1.8-1.6 4.4-2 8-2V4c-3.6 0-6.2.4-8 2Z" />
    <path d="M12 6v14" />
  </Svg>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);
export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z" />
  </Svg>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3v4h-4" />
  </Svg>
);
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3Z" />
  </Svg>
);
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.6 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9Z" />
  </Svg>
);
export const IconWand = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M5 19 16 8M14 6l1.5-1.5M18.5 10.5 20 9M18 3.5l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6.6-2Z" />
  </Svg>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4M12 17.2h.01" strokeWidth={2.4} />
  </Svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c.5-3.6 2.6-5.5 5.5-5.5s5 1.9 5.5 5.5" />
    <circle cx="16.5" cy="9" r="2.4" />
    <path d="M15.5 14.6c2.7.2 4.5 1.9 5 5.4" />
  </Svg>
);
export const IconSprout = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 21v-8" />
    <path d="M12 13C12 8.5 9 6 4.5 6 4.5 10.5 7.5 13 12 13Z" />
    <path d="M12 10c0-3.5 2.5-5.5 7.5-5.5 0 4.5-2.5 7-7.5 7" />
  </Svg>
);
export const IconPalette = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.8 2-1.8 0-1.4-1.4-1.9-1.4-3.2 0-1 .8-1.8 2-1.8H17a4 4 0 0 0 4-4c0-4-4-7.2-9-7.2Z" />
    <circle cx="7.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="7" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Svg>
);

export const GENRE_ICONS: Record<Genre, (p: SVGProps<SVGSVGElement>) => ReactNode> = {
  fairy_tale: IconCastle,
  space: IconRocket,
  superhero: IconBolt,
  forest: IconTree,
  underwater: IconFish,
  pirates: IconShip,
};

export const COMPANION_TYPE_ICONS: Record<CompanionType, (p: SVGProps<SVGSVGElement>) => ReactNode> = {
  pet: IconPaw,
  toy: IconTeddy,
};

export const COMPANION_ROLE_ICONS: Record<CompanionRole, (p: SVGProps<SVGSVGElement>) => ReactNode> = {
  protector: IconShield,
  joker: IconGrin,
  advisor: IconBulb,
  cheerleader: IconMegaphone,
};
