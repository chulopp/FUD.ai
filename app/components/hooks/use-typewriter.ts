"use client";

import { useEffect, useRef, useState } from "react";

export function useTypewriter(
  lines: string[],
  opts: { speed?: number; lineDelay?: number; fastForward?: boolean } = {},
) {
  const { speed = 22, lineDelay = 320, fastForward = false } = opts;
  const [rendered, setRendered] = useState<string[]>([""]);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setRendered([""]);
    setDone(false);
    let lineIdx = 0;
    let charIdx = 0;
    let lastTime = performance.now();
    let lineStart = performance.now();
    const effSpeed = fastForward ? 4 : speed;
    const effLineDelay = fastForward ? 40 : lineDelay;

    const tick = (now: number) => {
      if (lineIdx >= lines.length) {
        setDone(true);
        return;
      }
      const current = lines[lineIdx];
      const delta = now - lastTime;

      if (charIdx === 0 && now - lineStart < effLineDelay && lineIdx > 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (delta >= effSpeed) {
        charIdx += Math.max(1, Math.floor(delta / effSpeed));
        lastTime = now;
        if (charIdx >= current.length) {
          setRendered((prev) => {
            const next = [...prev];
            if (next[lineIdx] === undefined) next[lineIdx] = "";
            next[lineIdx] = current;
            return next;
          });
          lineIdx += 1;
          charIdx = 0;
          lineStart = now;
          if (lineIdx < lines.length) {
            setRendered((prev) => {
              const next = [...prev];
              while (next.length <= lineIdx) next.push("");
              return next;
            });
          }
        } else {
          const partial = current.slice(0, charIdx);
          setRendered((prev) => {
            const next = [...prev];
            while (next.length <= lineIdx) next.push("");
            next[lineIdx] = partial;
            return next;
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [lines.join("\n"), speed, lineDelay, fastForward]);

  return { rendered, done };
}
