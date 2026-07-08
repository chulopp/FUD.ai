"use client";

import { useEffect, useState } from "react";

interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  size?: number;
}

export function Gauge({ value, max = 100, label, size = 200 }: GaugeProps) {
  const [animated, setAnimated] = useState(0);
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - animated);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  const color =
    value >= 70
      ? "var(--verdict-bear)"
      : value >= 40
        ? "var(--verdict-neutral)"
        : "var(--verdict-bull)";

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1), stroke 0.4s",
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold tabular-nums" style={{ color }}>
          {Math.round(value)}
        </span>
        {label && (
          <span className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
