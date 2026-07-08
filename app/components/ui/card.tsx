import { cn } from "../../lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
