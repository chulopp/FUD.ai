"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Boxes, Network, GitBranch, RefreshCw } from "lucide-react";

const pillars = [
  {
    icon: Boxes,
    idx: "01",
    title: "Multidimensional Ingestion",
    body: "FUD.ai ingests three signal planes at once: on-chain contract state (GoPlus, RugCheck, DexScreener, order book), social chatter (Twitter + Telegram), and visual / contextual cues. No single source is trusted alone — every verdict is cross-validated across planes so a coordinated tweet storm can&apos;t override what the chain actually says.",
    tag: "On-chain + social + visual",
  },
  {
    icon: Network,
    idx: "02",
    title: "Coordination & Sybil Detection",
    body: "The core differentiator. FUD.ai computes explicit coordination metrics — unique author ratio, near-duplicate text clustering (Jaccard), and cross-platform burst windows — to tell you whether the fear is organic or manufactured. A panic with 0.15 author ratio and a 4-minute burst window is not the same as a panic with 0.85 author ratio spread over a day.",
    tag: "Author ratio · clustering · bursts",
  },
  {
    icon: GitBranch,
    idx: "03",
    title: "MCTS-Inspired Reasoning",
    body: "Instead of one linear conclusion, the engine branches into three parallel scenarios — Real Crash, False FUD, and Whale Manipulation — and scores each branch against the evidence. The dominant branch wins, but the full probability distribution is exposed so downstream agents can hedge rather than blindly trust a single label.",
    tag: "3 parallel scenarios",
  },
  {
    icon: RefreshCw,
    idx: "04",
    title: "Reflexion Loop",
    body: "Every verdict is recorded. When a past prediction turns out wrong, the reflexion loop extracts what the evidence chain missed and recalibrates confidence for similar future cases. This means FUD.ai gets sharper the more it runs — it doesn&apos;t repeat the same misread twice.",
    tag: "Learns from misses",
  },
];

function Card({
  pillar,
  position,
  total,
  progress,
  range,
}: {
  pillar: (typeof pillars)[number];
  position: number;
  total: number;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const scale = useTransform(progress, range, [1, 0.95]);
  const opacity = useTransform(progress, range, [1, 0.55]);

  return (
    <div className="sticky h-screen" style={{ top: 80, zIndex: position + 1 }}>
      <motion.div
        style={{ scale, opacity }}
        className="flex h-[calc(100vh-80px)] items-center"
      >
        <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-xl sm:p-12 lg:p-16">
          <div className="bg-dotmatrix-dense pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
                <span className="text-verdict-bull">*{pillar.idx}</span>
                <span>/ 0{total}</span>
              </div>
              <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-verdict-bull">
                <pillar.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-2xl font-bold tracking-tight sm:text-4xl">
                {pillar.title}
              </h3>
              <p
                className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base"
                dangerouslySetInnerHTML={{ __html: pillar.body }}
              />
            </div>
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-border bg-surface-2 p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Differentiator
                </p>
                <p className="mt-3 text-lg font-semibold text-verdict-bull">
                  {pillar.tag}
                </p>
                <div className="mt-6 h-px w-full bg-border" />
                <p className="mt-4 font-mono text-xs text-muted-foreground">
                  pillar_{pillar.idx}.engine
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function StickyStack() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const segment = 1 / pillars.length;

  return (
    <section id="about" className="relative">
      <div className="mx-auto max-w-7xl px-4 pt-24 text-center sm:px-6 sm:pt-32 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-verdict-bull">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
          Four pillars. One verdict.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">
          Scroll through the architecture that makes FUD.ai different from every sentiment
          tool you&apos;ve tried.
        </p>
      </div>

      <div ref={containerRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {pillars.map((p, i) => (
            <Card
              key={p.idx}
              pillar={p}
              position={i}
              total={pillars.length}
              progress={scrollYProgress}
              range={[
                Math.max(0, i * segment - 0.02),
                Math.min(1, (i + 1) * segment),
              ]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
