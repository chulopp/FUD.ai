"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const pillars = [
  {
    idx: "01",
    title: "Multidimensional Ingestion",
    body: "FUD.ai ingests three signal planes at once: real-time on-chain contract states, social chatter volume, and contextual market cues. No single source is trusted alone — every verdict is cross-validated across planes so a coordinated tweet storm can't override what the actual money flow dictates.",
    tag: "On-chain + social + visual",
  },
  {
    idx: "02",
    title: "Coordination & Sybil Detection",
    body: "The core differentiator. FUD.ai computes explicit coordination metrics — unique author ratios, near-duplicate text clustering, and cross-platform burst windows — to tell you whether the fear is organic or manufactured. A panic with a tight 4-minute burst window and massive duplicate texts is an attack, not a trend.",
    tag: "Author ratio · clustering · bursts",
  },
  {
    idx: "03",
    title: "MCTS-Inspired Reasoning",
    body: "Instead of one linear conclusion, the engine branches into three parallel scenarios: Real Crash, False FUD, and Whale Manipulation. It scores each branch against the evidence. The dominant branch wins, but the full probability distribution is exposed so downstream agents can hedge accurately.",
    tag: "3 parallel scenarios",
  },
  {
    idx: "04",
    title: "Reflexion Loop",
    body: "Every verdict is recorded. When a past prediction turns out wrong, the reflexion loop extracts what the evidence chain missed and recalibrates confidence for similar future cases. This means FUD.ai gets sharper the more it runs — it doesn&apos;t repeat the same misread twice.",
    tag: "Learns from misses",
  },
];

const pillarImages: Record<string, { src: string; alt: string }> = {
  "01": { src: "/data.svg", alt: "Multidimensional Ingestion Data Flow" },
  "02": { src: "/sybil.svg", alt: "Coordination & Sybil Detection Diagram" },
  "03": { src: "/mcts.svg", alt: "MCTS-Inspired Reasoning Diagram" },
  "04": { src: "/loop.svg", alt: "Reflexion Loop Diagram" },
};

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
  const scale = useTransform(progress, range, [1, 0.96]);

  const imgData = pillarImages[pillar.idx];

  return (
    <div
      className="sticky top-24 rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden"
      style={{ zIndex: position + 1 }}
    >
      <motion.div style={{ scale }}>
        <div className="relative w-full p-8 md:p-12">
          <div className="bg-dotmatrix-dense pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative grid gap-8 md:grid-cols-2 items-center">
            <div>
              <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
                <span className="text-verdict-bull">*{pillar.idx}</span>
                <span>/ 0{total}</span>
              </div>
              <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">
                {pillar.title}
              </h3>
              <p
                className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base"
                dangerouslySetInnerHTML={{ __html: pillar.body }}
              />
            </div>
            <div className="hidden md:block">
              <div className="rounded-2xl border border-border bg-surface-2 p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Differentiator
                </p>
                <p className="mt-3 text-lg font-semibold text-verdict-bull">
                  {pillar.tag}
                </p>
                {imgData ? (
                  <div className="relative w-full h-48 mt-6 overflow-hidden flex items-center justify-center">
                    <img
                      src={imgData.src}
                      alt={imgData.alt}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="bg-white/5 border border-border rounded-xl w-full h-48 mt-6 flex items-center justify-center text-muted-foreground">
                    Image Placeholder
                  </div>
                )}
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
      <div className="mx-auto max-w-7xl px-4 pt-24 pb-12 text-center sm:px-6 sm:pt-32 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Four pillars. <span className="text-verdict-bull">One verdict.</span>
        </h2>
      </div>

      <div ref={containerRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex flex-col gap-[70vh] pb-32">
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
