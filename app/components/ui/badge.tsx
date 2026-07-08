import { cn } from "../../lib/utils";

type Tone = "bull" | "bear" | "neutral" | "muted";

const tones: Record<Tone, string> = {
  bull: "bg-verdict-bull/12 text-verdict-bull border-verdict-bull/30",
  bear: "bg-verdict-bear/12 text-verdict-bear border-verdict-bear/30",
  neutral: "bg-verdict-neutral/12 text-verdict-neutral border-verdict-neutral/30",
  muted: "bg-surface-2 text-muted-foreground border-border",
};

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
