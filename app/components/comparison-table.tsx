import { Check, X } from "lucide-react";

const rows = [
  {
    criterion: "Focus",
    general: "General-purpose AI. Crypto sentiment is one of thousands of topics. No specialization in FUD detection or market manipulation.",
    aggregator: "Aggregates raw social sentiment scores. No distinction between organic fear and manufactured FUD.",
    fud: "Built exclusively for crypto sentiment analysis — detects FUD, whale manipulation, and coordinated attacks using multi-branch reasoning.",
  },
  {
    criterion: "Cost per analysis",
    general: "~$0.10–$0.30 per query via API, plus latency from general-purpose models.",
    aggregator: "Subscription tiers from $24 to $240+ per month depending on limits, regardless of usage volume.",
    fud: "Flat rate via CROO Agent Store. Pay only when you query, not for idle months.",
  },
  {
    criterion: "Coordination & Sybil Detection",
    general: "Not publicly documented. General LLMs have no out-of-the-box mechanism to detect coordinated bot waves.",
    aggregator: "Not publicly documented. Social scores are susceptible to undetected bot inflation.",
    fud: "Explicit detection — measures unique author ratio, near-duplicate text clustering, and cross-platform burst windows to flag coordinated attacks.",
  },
  {
    criterion: "On-chain Cross-validation",
    general: "No on-chain access whatsoever. Analysis is based on training data, not live market state.",
    aggregator: "Limited. Social scores are not validated against actual on-chain money flows.",
    fud: "Sentiment is cross-validated against real-time on-chain state — divergence between social volume and market signals is explicitly flagged, not silently ignored.",
  },
  {
    criterion: "Self-correction",
    general: "No memory between queries. Makes the same analytical errors repeatedly.",
    aggregator: "No learning mechanism. Score methodologies are static.",
    fud: "Reflexion Loop — records each verdict and recalibrates confidence for similar future cases when past predictions are wrong. Gets sharper over time.",
  },
  {
    criterion: "Agent-to-agent access",
    general: "Not native. Requires manual API integration per use case.",
    aggregator: "Not native.",
    fud: "Native — directly callable by other bots and AI agents via CROO Network, with on-chain settlement per use.",
  },
];

export function ComparisonTable() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-verdict-bull">
            Head to head
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            FUD.ai vs everyone else
          </h2>
          <p className="mt-4 text-muted-foreground sm:text-lg">
            Six criteria that determine whether a sentiment tool can actually protect you from getting rekt.
          </p>
        </div>

        {/* Desktop table */}
        <div className="mt-12 hidden overflow-hidden rounded-2xl border border-border lg:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-6 py-4 font-semibold text-muted-foreground">Criteria</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">
                  General AI
                  <span className="block text-xs font-normal">
                    ChatGPT / Claude / Gemini
                  </span>
                </th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">
                  Sentiment Aggregator
                  <span className="block text-xs font-normal">
                    LunarCrush / Santiment-style
                  </span>
                </th>
                <th className="bg-verdict-bull/[0.06] px-6 py-4 font-semibold text-verdict-bull">
                  FUD.ai
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.criterion}
                  className={i % 2 === 0 ? "bg-surface" : "bg-surface-2/40"}
                >
                  <td className="px-6 py-4 font-medium">{r.criterion}</td>
                  <td className="px-6 py-4 text-muted-foreground">{r.general}</td>
                  <td className="px-6 py-4 text-muted-foreground">{r.aggregator}</td>
                  <td className="bg-verdict-bull/[0.04] px-6 py-4 font-medium text-foreground">
                    <div className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-verdict-bull" />
                      <span>
                        {r.criterion === "Cost per analysis" ? (
                          <>
                            <span className="text-verdict-bull font-semibold">$0.02</span> per query. {r.fud}
                          </>
                        ) : (
                          r.fud
                        )}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-12 space-y-4 lg:hidden">
          {rows.map((r) => (
            <div key={r.criterion} className="rounded-2xl border border-border bg-surface p-5">
              <p className="font-semibold">{r.criterion}</p>
              <div className="mt-4 space-y-3">
                <MobileRow label="General AI" value={r.general} ok={false} />
                <MobileRow label="Aggregator" value={r.aggregator} ok={false} />
                <MobileRow
                  label="FUD.ai"
                  value={
                    r.criterion === "Cost per analysis" ? (
                      <span>
                        <span className="text-verdict-bull font-semibold">$0.02</span> per query. {r.fud}
                      </span>
                    ) : (
                      r.fud
                    )
                  }
                  ok
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileRow({ label, value, ok }: { label: string; value: React.ReactNode; ok: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        ok
          ? "border-verdict-bull/30 bg-verdict-bull/[0.06]"
          : "border-border bg-surface-2"
      }`}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <Check className="h-3.5 w-3.5 text-verdict-bull" />
        ) : (
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className={`text-xs font-semibold ${ok ? "text-verdict-bull" : "text-muted-foreground"}`}>
          {label}
        </span>
      </div>
      <div className={`mt-1.5 text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
