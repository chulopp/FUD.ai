"use client";

import dynamic from "next/dynamic";
import { Badge } from "./ui/badge";
import { Gauge } from "./ui/gauge";
import { useMemo } from "react";
import { Activity, Database, Network, ShieldCheck, Users } from "lucide-react";

const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false },
);
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

export interface Verdict {
  executable_verdict:
    | "LIQUIDATE_LONGS"
    | "HOLD"
    | "ACCUMULATE"
    | "IGNORE_FUD"
    | "INSUFFICIENT_DATA";
  drama_index: number;
  confidence: number | null;
  dominant_branch: string;
  evidence_chain: string[];
  coordination_signals: {
    unique_author_ratio: number;
    duplicate_text_cluster_size: number;
    cross_platform_burst_window_minutes: number;
  };
  served_from_cache: boolean;
  branch_probabilities: Record<string, number>;
}

const verdictTone: Record<Verdict["executable_verdict"], "bull" | "bear" | "neutral"> = {
  ACCUMULATE: "bull",
  IGNORE_FUD: "bull",
  HOLD: "neutral",
  LIQUIDATE_LONGS: "bear",
  INSUFFICIENT_DATA: "neutral",
};

const verdictLabel: Record<Verdict["executable_verdict"], string> = {
  ACCUMULATE: "ACCUMULATE",
  IGNORE_FUD: "IGNORE_FUD",
  HOLD: "HOLD",
  LIQUIDATE_LONGS: "LIQUIDATE_LONGS",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
};

function prefixColor(prefix: string): "bull" | "bear" | "neutral" | "muted" {
  const p = prefix.toUpperCase();
  if (p.includes("SECURITY") || p.includes("RUGCHECK") || p.includes("GOPLUS")) return "bear";
  if (p.includes("SYBIL") || p.includes("COORD")) return "neutral";
  if (p.includes("ON-CHAIN") || p.includes("MARKET") || p.includes("ORDER")) return "bull";
  if (p.includes("SOCIAL") || p.includes("TWITTER") || p.includes("TELEGRAM")) return "muted";
  return "muted";
}

const branchColor = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes("crash") || k.includes("real")) return "var(--verdict-bear)";
  if (k.includes("manip") || k.includes("whale") || k.includes("paus")) return "var(--verdict-neutral)";
  if (k.includes("fud") || k.includes("false")) return "var(--verdict-bull)";
  return "var(--accent)";
};

export function VerdictShowcase({
  verdict,
  coinSymbol,
}: {
  verdict: Verdict;
  coinSymbol: string;
}) {
  const tone = verdictTone[verdict.executable_verdict];

  const verdictColor = useMemo(() => {
    switch (verdict.executable_verdict) {
      case "ACCUMULATE":
      case "IGNORE_FUD":
        return "#10b981"; // emerald/green
      case "HOLD":
        return "#f59e0b"; // amber/orange
      case "LIQUIDATE_LONGS":
        return "#f43f5e"; // rose/red
      default:
        return "#71717a"; // zinc/gray
    }
  }, [verdict.executable_verdict]);

  const isDominantBranch = (branchName: string) => {
    if (!verdict.dominant_branch) return false;
    const cleanBranch = branchName.toLowerCase().trim();
    const cleanDominant = verdict.dominant_branch.toLowerCase().trim();
    return cleanBranch === cleanDominant 
      || cleanBranch.includes(cleanDominant) 
      || cleanDominant.includes(cleanBranch);
  };

  const branchData = useMemo(
    () =>
      Object.entries(verdict.branch_probabilities || {}).map(([k, v]) => ({
        name: k.length > 14 ? k.slice(0, 12) + "…" : k,
        fullName: k,
        value: Math.round((v as number) * 100),
      })),
    [verdict.branch_probabilities],
  );

  const evidenceParsed = useMemo(
    () =>
      (verdict.evidence_chain || []).map((e) => {
        const m = e.match(/^\[([A-Z_]+)\]\s*(.*)$/);
        if (m) return { prefix: m[1], text: m[2] };
        return { prefix: null, text: e };
      }),
    [verdict.evidence_chain],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Verdict · {coinSymbol.toUpperCase()}
          </p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Analysis complete
          </h3>
        </div>
        <Badge tone={verdict.served_from_cache ? "muted" : "bull"}>
          {verdict.served_from_cache ? "cached" : "fresh"}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {/* Left: gauge + confidence */}
        <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col items-center">
          <Gauge value={verdict.drama_index} label="drama_index" size={200} />
          <div className="mt-6 w-full">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">confidence</span>
              <span className="font-mono font-semibold">
                {verdict.confidence === null
                  ? "n/a"
                  : `${Math.round(verdict.confidence * 100)}%`}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  backgroundColor: verdictColor,
                  width:
                    verdict.confidence === null
                      ? "0%"
                      : `${Math.round(verdict.confidence * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: verdict badge + dominant branch chart */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            executable_verdict
          </p>
          <div
            className={`mt-3 inline-flex items-center rounded-xl border px-5 py-3 text-xl font-extrabold tracking-tight ${
              tone === "bull"
                ? "border-verdict-bull/40 bg-verdict-bull/10 text-verdict-bull"
                : tone === "bear"
                  ? "border-verdict-bear/40 bg-verdict-bear/10 text-verdict-bear"
                  : "border-verdict-neutral/40 bg-verdict-neutral/10 text-verdict-neutral"
            }`}
          >
            {verdictLabel[verdict.executable_verdict]}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            dominant_branch:{" "}
            <span className="font-mono font-semibold text-foreground">
              {verdict.dominant_branch}
            </span>
          </p>

          {branchData.length > 0 && (
            <div className="mt-5 h-44">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchData} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "var(--muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "var(--muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, "Probability"]}
                      labelFormatter={(label: any, items: any) => {
                        const item = items[0]?.payload;
                        return item ? item.fullName : label;
                      }}
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#ffffff",
                      }}
                      itemStyle={{ color: "#ffffff" }}
                      labelStyle={{ color: "#ffffff", fontWeight: "600" }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {branchData.map((d) => {
                        const isDom = isDominantBranch(d.fullName);
                        return (
                          <Cell 
                            key={d.fullName} 
                            fill={isDom ? verdictColor : "#52525b"} 
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Coordination signals — highlighted differentiator */}
      <div className="mt-5 rounded-2xl border border-verdict-neutral/30 bg-verdict-neutral/[0.04] p-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-verdict-neutral" />
          <p className="font-mono text-xs uppercase tracking-widest text-verdict-neutral">
            coordination_signals · core differentiator
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <CoordStat
            icon={Network}
            label="unique_author_ratio"
            value={verdict.coordination_signals?.unique_author_ratio?.toFixed(2) ?? "—"}
            hint={(() => {
              const r = verdict.coordination_signals?.unique_author_ratio;
              if (r === undefined) return "—";
              if (r < 0.3) return "highly coordinated";
              if (r < 0.6) return "moderate coordination";
              return "organic";
            })()}
          />
          <CoordStat
            icon={Activity}
            label="duplicate_text_cluster_size"
            value={String(verdict.coordination_signals?.duplicate_text_cluster_size ?? "—")}
            hint={
              (verdict.coordination_signals?.duplicate_text_cluster_size ?? 0) > 5
                ? "copy-paste botnet"
                : "low duplication"
            }
          />
          <CoordStat
            icon={ShieldCheck}
            label="burst_window_minutes"
            value={`${verdict.coordination_signals?.cross_platform_burst_window_minutes ?? 0}m`}
            hint={
              (verdict.coordination_signals?.cross_platform_burst_window_minutes ?? 0) < 10
                ? "synchronized burst"
                : "spread organically"
            }
          />
        </div>
      </div>

      {/* Evidence chain */}
      <div className="mt-5 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            evidence_chain
          </p>
        </div>
        <ul className="mt-4 space-y-2.5">
          {evidenceParsed.map((e, i) => (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm"
            >
              {e.prefix && (
                <Badge tone={prefixColor(e.prefix)} className="font-mono text-[10px]">
                  [{e.prefix}]
                </Badge>
              )}
              <span className="text-muted-foreground">{e.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CoordStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
