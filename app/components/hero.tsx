"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Play, Network, Code } from "lucide-react";
import { LinkButton } from "./ui/button";
import { NetworkBackground } from "./network-background";

const CROO_LISTING = "https://agent.croo.network";

/* ── Floating card positions (lg+ only) ── */
const cardPositions = {
  "top-left": "absolute top-[14%] left-[6%]",
  "bottom-left": "absolute bottom-[16%] left-[8%]",
  "top-right": "absolute top-[16%] right-[6%]",
  "bottom-right": "absolute bottom-[14%] right-[7%]",
} as const;

function FloatingCard({
  position,
  delay,
  children,
}: {
  position: keyof typeof cardPositions;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`hidden lg:flex ${cardPositions[position]} w-56 flex-col gap-2 rounded-xl border border-border bg-surface/90 p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [-8, 8, -8] }}
      transition={{
        opacity: { duration: 0.6, delay },
        y: {
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
      }}
    >
      {children}
    </motion.div>
  );
}

function Sparkline() {
  // Mini dummy sparkline polyline
  const points = "0,22 14,16 28,20 42,10 56,18 70,6 84,14 98,2";
  return (
    <svg width="100%" height="24" viewBox="0 0 98 24" fill="none" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="var(--verdict-bear)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <circle cx="98" cy="2" r="2" fill="var(--verdict-bear)" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-16">
      <div className="bg-dotmatrix pointer-events-none absolute inset-0 -z-10" />
      <NetworkBackground />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-verdict-bull/[0.06] via-transparent to-transparent" />

      <div className="relative mx-auto flex min-h-[90vh] max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        {/* ── Floating decorative cards (lg+ only) ── */}
        <FloatingCard position="top-left" delay={0}>
          <div className="flex items-center gap-2">
            <Image
              src="/whale.jpg"
              alt="Whale"
              width={24}
              height={24}
              className="h-6 w-6 rounded-full object-cover"
            />
            <span className="text-[10px] font-medium text-muted-foreground">@whale_alert</span>
          </div>
          <p className="text-xs leading-snug text-foreground/80">
            Whale wallet just transferred 50M $PEPE to Binance…
          </p>
        </FloatingCard>

        <FloatingCard position="bottom-left" delay={1}>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-verdict-neutral" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              On-chain
            </span>
          </div>
          <p className="text-xs leading-snug text-foreground/80">
            Sybil Activity: <span className="font-mono font-semibold text-verdict-neutral">45</span> linked wallets detected
          </p>
        </FloatingCard>

        <FloatingCard position="top-right" delay={2}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              $PEPE
            </span>
            <span className="font-mono text-xs font-bold text-verdict-bear">-15%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">High Volatility</p>
          <Sparkline />
        </FloatingCard>

        <FloatingCard position="bottom-right" delay={3}>
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-verdict-bull" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Verdict
            </span>
          </div>
          <pre className="mt-1 overflow-hidden rounded-md bg-surface-2 p-2 font-mono text-[10px] leading-relaxed text-verdict-bull">
            <code>{`"executable_verdict":
  "ACCUMULATE"`}</code>
          </pre>
        </FloatingCard>

        {/* ── Center content ── */}
        <div className="relative z-10 mx-auto max-w-xl text-center">
          {/* NEW pill badge */}
          <motion.a
            href="#live-demo"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="group mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 backdrop-blur-md transition-colors hover:border-verdict-bull/40 hover:bg-surface"
          >
            <motion.span
              animate={{ opacity: [1, 0.65, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-background"
            >
              NEW
            </motion.span>
            <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
              Demo quota is now available →
            </span>
          </motion.a>

          {/* Main heading */}
          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
            Detect FUD before
            <br />
            it <span className="text-gradient">liquidates you.</span>
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mt-5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            FUD.ai is an agentic layer that separates organic fear from manipulation. It
            fuses on-chain evidence with an MCTS-inspired loop to deliver an executable
            verdict.
          </p>

          {/* Buttons */}
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton
              href={CROO_LISTING}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
              className="relative overflow-hidden px-5 py-2.5 text-sm"
            >
              <span className="relative z-10 flex items-center gap-2">
                Hire on CROO Agent Store
                <ArrowRight className="h-4 w-4" />
              </span>
              <span className="shine-sweep pointer-events-none absolute inset-y-0 -left-[120%] w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/25" />
            </LinkButton>
            <LinkButton
              href="#live-demo"
              variant="secondary"
              size="sm"
              className="px-5 py-2.5 text-sm"
            >
              <Play className="h-4 w-4" />
              See it in action
            </LinkButton>
          </div>

          {/* Feature tags */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-verdict-bull" />
              Pay-per-call via USDC
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-verdict-neutral" />
              Agent-to-agent native
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-verdict-bear" />
              Reflexion-calibrated
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
