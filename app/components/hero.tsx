import Image from "next/image";
import { ArrowRight, Play, ShieldAlert } from "lucide-react";
import { LinkButton } from "./ui/button";
import { Badge } from "./ui/badge";

const CROO_LISTING = "https://agent.croo.network";

const verdictSnippet = `{
  "executable_verdict": "ACCUMULATE",
  "drama_index": 38,
  "confidence": 0.82,
  "dominant_branch": "false_fud",
  "coordination_signals": {
    "unique_author_ratio": 0.71,
    "duplicate_text_cluster_size": 2,
    "cross_platform_burst_window_minutes": 0
  }
}`;

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-16">
      <div className="bg-dotmatrix pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-verdict-bull/[0.06] via-transparent to-transparent" />

      <div className="mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32 lg:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="bull" className="mb-6">
            <ShieldAlert className="h-3.5 w-3.5" />
            On-chain FUD intelligence · CROO Agent
          </Badge>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Detect coordinated FUD
            <br />
            <span className="text-gradient">before it liquidates you.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            FUD.ai is an agentic intelligence layer that separates organic fear from
            coordinated manipulation. It fuses on-chain evidence, social signals, and
            sybil detection — then reasons across multiple scenarios with an MCTS-inspired
            loop to deliver an executable verdict any agent can act on.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton
              href={CROO_LISTING}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="lg"
            >
              View on CROO Agent Store
              <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton href="#live-demo" variant="secondary" size="lg">
              <Play className="h-4 w-4" />
              See it in action
            </LinkButton>
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-muted-foreground">
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

        <div className="relative mx-auto mt-16 max-w-2xl">
          <pre className="select-none overflow-hidden rounded-xl border border-border bg-surface/60 px-5 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground/40 backdrop-blur-md sm:text-xs">
            <code>{verdictSnippet}</code>
          </pre>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
