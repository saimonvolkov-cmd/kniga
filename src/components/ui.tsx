import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconCheck } from "./icons";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "ghost" | "dark" | "coral";

export function ChunkyButton({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-marigold text-pine border-ink",
    coral: "bg-coral text-paper border-ink",
    dark: "bg-pine text-foam border-ink",
    ghost: "bg-paper text-ink border-ink",
  };
  return (
    <button
      {...props}
      className={cx(
        "btn-press inline-flex items-center justify-center gap-2 rounded-2xl border-[2.5px] px-5 py-3 font-display text-[15px] font-bold shadow-block-sm disabled:cursor-not-allowed disabled:opacity-40",
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function SectionHead({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <span className="inline-block -rotate-2 rounded-lg border-2 border-ink bg-coral px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-paper shadow-block-sm">
        {step}
      </span>
      <h2 className="mt-3 font-display text-[27px] font-bold leading-tight text-pine sm:text-[32px]">{title}</h2>
      {subtitle ? <p className="mt-2 max-w-md text-[15px] font-semibold leading-snug text-ink/70">{subtitle}</p> : null}
    </div>
  );
}

export function OptionCard({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "btn-press group relative flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-paper p-4 text-left shadow-block-sm",
        selected && "-translate-y-0.5 bg-marigold",
        className
      )}
    >
      {children}
      <span
        className={cx(
          "absolute -right-2.5 -top-2.5 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-fern text-paper opacity-0 shadow-block-sm transition-opacity",
          selected && "animate-pop opacity-100"
        )}
      >
        <IconCheck className="h-4 w-4" strokeWidth={3} />
      </span>
    </button>
  );
}

export function Sticker({ children, color = "#7fb069", className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-extrabold text-paper shadow-block-sm", className)}
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

export interface ToastItem {
  id: number;
  kind: "ok" | "warn" | "err";
  text: string;
}

export function Toasts({ items, onClose }: { items: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-2">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onClose(t.id)}
          className={cx(
            "animate-pop pointer-events-auto rounded-xl border-[2.5px] border-ink px-4 py-3 text-left text-sm font-bold shadow-block-sm",
            t.kind === "ok" && "bg-fern text-paper",
            t.kind === "warn" && "bg-marigold text-pine",
            t.kind === "err" && "bg-coral text-paper"
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
