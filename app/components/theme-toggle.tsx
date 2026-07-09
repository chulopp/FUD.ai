"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = async () => {
    const next = isDark ? "light" : "dark";

    // Set clip-path origin from button position
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      document.documentElement.style.setProperty("--theme-x", `${x}px`);
      document.documentElement.style.setProperty("--theme-y", `${y}px`);
    }

    const supportsVT =
      typeof document !== "undefined" &&
      typeof (document as any).startViewTransition === "function";

    if (supportsVT) {
      // Suppress CSS transitions during VT to avoid double-animation flicker
      const root = document.documentElement;
      root.classList.add("vt-active");
      const vt = (document as any).startViewTransition(() => {
        setTheme(next);
      });
      vt.finished.finally(() => {
        root.classList.remove("vt-active");
      });
    } else {
      setTheme(next);
    }
  };

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <div className="h-4 w-4" />
      )}
    </button>
  );
}
