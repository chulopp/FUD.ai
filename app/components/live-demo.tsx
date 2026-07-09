"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Terminal, Loader2, AlertTriangle, ArrowRight, Bot } from "lucide-react";
import { Button } from "./ui/button";
import {
  getDemoFingerprint,
  getDemoUsage,
  incrementDemoUsage,
  DEMO_WEEKLY_LIMIT,
} from "../lib/demo-fingerprint";
import { VerdictShowcase, type Verdict } from "./verdict-showcase";

const ALL_LOG_LINES = [
  "> Scraping Twitter & Telegram signals...",
  "> Scanning smart-contract on-chain vulnerabilities...",
  "> Computing coordination & sybil signals...",
  "> Running MCTS hypothesis branches (A/B/C)...",
  "> Cross-validating social vs on-chain pressure...",
  "> Checking reflexion memory for similar past cases...",
  "> Still verifying evidence chain...",
  "> Re-weighing branch probabilities...",
  "> Awaiting final consensus...",
];

// ── Self-contained character-by-character terminal typer ──────────────────
function useTerminalTyper(runId: number, fastForward: boolean) {
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [currentTyping, setCurrentTyping] = useState("");
  const abortRef = useRef(false);

  // Start fresh every time runId changes
  useEffect(() => {
    if (runId === 0) return;
    abortRef.current = false;
    setCompletedLines([]);
    setCurrentTyping("");

    let lineIdx = 0;

    function typeNextLine() {
      if (abortRef.current || lineIdx >= ALL_LOG_LINES.length) return;
      const line = ALL_LOG_LINES[lineIdx];
      let charIdx = 0;

      function typeChar() {
        if (abortRef.current) return;
        charIdx++;
        if (charIdx >= line.length) {
          // Line complete — move to completed list
          setCurrentTyping("");
          setCompletedLines((prev) => [...prev, line]);
          lineIdx++;
          setTimeout(typeNextLine, 3000);
        } else {
          setCurrentTyping(line.slice(0, charIdx));
          setTimeout(typeChar, 40);
        }
      }

      typeChar();
    }

    typeNextLine();
    return () => { abortRef.current = true; };
  }, [runId]);

  // Fast-forward: immediately show all lines when job finishes
  useEffect(() => {
    if (!fastForward) return;
    abortRef.current = true;
    setCompletedLines(ALL_LOG_LINES);
    setCurrentTyping("");
  }, [fastForward]);

  return { completedLines, currentTyping };
}

type Phase = "idle" | "running" | "done" | "error";

export function LiveDemo() {
  const [coin, setCoin] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usageLeft, setUsageLeft] = useState<number>(DEMO_WEEKLY_LIMIT);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [finalCoin, setFinalCoin] = useState("");
  const [runId, setRunId] = useState(0);
  const [pipelineDone, setPipelineDone] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const { completedLines, currentTyping } = useTerminalTyper(runId, pipelineDone);

  useEffect(() => {
    setUsageLeft(Math.max(0, DEMO_WEEKLY_LIMIT - getDemoUsage().count));
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [completedLines, currentTyping]);

  const pollJob = useCallback(
    async (jobId: string): Promise<Verdict | null> => {
      const start = Date.now();
      while (Date.now() - start < 300_000) {
        await new Promise((r) => setTimeout(r, 1800));
        try {
          const res = await fetch(`/api/agent/${jobId}`, {
            headers: { "X-Demo-Fingerprint": getDemoFingerprint() },
          });
          const data = await res.json();
          if (data.status === "completed") {
            return data as unknown as Verdict;
          }
          if (data.status === "failed") {
            throw new Error(data.error || "Pipeline failed");
          }
        } catch {
          // network blip — keep polling
        }
      }
      return null;
    },
    [],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const sym = coin.trim();
      if (!sym || phase === "running") return;

      // client-side soft rate limit
      const usage = getDemoUsage();
      if (usage.count >= DEMO_WEEKLY_LIMIT) {
        setError(
          `Demo limit reached (${DEMO_WEEKLY_LIMIT}/week). Integrate via CROO Agent Store for full access.`,
        );
        setPhase("error");
        return;
      }

      setError(null);
      setVerdict(null);
      setPipelineDone(false);
      setFinalCoin(sym);
      setRunId(Date.now());
      setPhase("running");

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Demo-Fingerprint": getDemoFingerprint(),
          },
          body: JSON.stringify({ coin_symbol: sym.toUpperCase() }),
        });

        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || "Too many concurrent analyses. Retry in a moment.",
          );
        }
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ||
              `Demo limit reached. Integrate via CROO Agent Store for full access.`,
          );
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const { job_id } = await res.json();
        if (!job_id) throw new Error("No job_id returned");

        // increment client-side counter after successful submit
        const updated = incrementDemoUsage();
        setUsageLeft(Math.max(0, DEMO_WEEKLY_LIMIT - updated.count));

        const result = await pollJob(job_id);
        if (!result) {
          throw new Error("Analysis timed out. Try again in a moment.");
        }
        setVerdict(result);
        setPhase("done");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setPhase("error");
      }
    },
    [coin, phase, pollJob],
  );

  return (
    <section id="live-demo" className="relative scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-verdict-bull">
            Live demo
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            See FUD.ai think.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">
            Enter a coin symbol. Watch the pipeline run. Get an executable verdict backed
            by on-chain evidence and coordination signals.
          </p>
        </div>

        {/* Input */}
        <form
          onSubmit={onSubmit}
          className="mx-auto mt-10 flex max-w-lg flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={coin}
              onChange={(e) => setCoin(e.target.value)}
              placeholder="e.g. PEPE"
              disabled={phase === "running"}
              className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-4 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-verdict-bull/50 disabled:opacity-50"
              maxLength={12}
            />
          </div>
          <Button type="submit" size="lg" disabled={phase === "running" || !coin.trim()}>
            {phase === "running" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                Run analysis
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>
            {usageLeft > 0 ? (
              <>
                <span className="font-mono font-semibold text-foreground">{usageLeft}</span>{" "}
                / {DEMO_WEEKLY_LIMIT} demo calls left this week
              </>
            ) : (
              <span className="text-verdict-neutral">Weekly demo limit reached</span>
            )}
          </span>
        </div>

        {/* Error */}
        {phase === "error" && error && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-verdict-neutral/40 bg-verdict-neutral/[0.06] p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-verdict-neutral" />
              <div>
                <p className="font-medium">{error}</p>
                <a
                  href="https://agent.croo.network/agents/4799b7fe-3b19-4435-bdfe-93de07ec5c40?from=search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-2 text-verdict-bull hover:underline"
                >
                  <Bot className="h-3.5 w-3.5" />
                  Hire on CROO Agent Store
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Terminal */}
        {(phase === "running" || phase === "done") && !verdict && (
          <div className="mx-auto mt-8 max-w-2xl">
            <div className="overflow-hidden rounded-xl border border-border bg-[var(--terminal-bg)] shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="ml-2 flex items-center gap-1.5 font-mono text-xs text-white/40">
                  <Terminal className="h-3 w-3" />
                  fud-ai@pipeline:~{finalCoin ? `/${finalCoin.toLowerCase()}` : ""}
                </span>
              </div>
              <div
                ref={terminalRef}
                className="terminal-scroll h-72 overflow-y-auto px-4 py-4 font-mono text-sm leading-relaxed text-[var(--terminal-text)]"
              >
                {completedLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
                {currentTyping && (
                  <div className="whitespace-pre-wrap">
                    {currentTyping}
                    <span className="cursor-blink ml-0.5">▋</span>
                  </div>
                )}
                {!currentTyping && !pipelineDone && completedLines.length >= ALL_LOG_LINES.length && (
                  <div className="text-white/30">
                    <span className="cursor-blink">▋</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verdict */}
        {phase === "done" && verdict && (
          <div className="mt-10 animate-in fade-in duration-500">
            <VerdictShowcase verdict={verdict} coinSymbol={finalCoin} />
            <div className="mt-8 text-center">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setPhase("idle");
                  setVerdict(null);
                  setCoin("");
                }}
              >
                Run another analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
