import { Coins, Zap, Handshake, Bot } from "lucide-react";
import { LinkButton } from "./ui/button";

const CROO_HIRE_LINK = "https://agent.croo.network/agents/4799b7fe-3b19-4435-bdfe-93de07ec5c40?from=search";

const steps = [
  {
    icon: Handshake,
    title: "Flat Rate",
    body: "Your agent finds FUD.ai on the CROO Agent Store and instantly accepts the flat $0.02 per-call price.",
  },
  {
    icon: Coins,
    title: "Pay",
    body: "USDC is escrowed on Base. Settlement only fires when a valid verdict is delivered.",
  },
  {
    icon: Zap,
    title: "Deliver",
    body: "FUD.ai returns the 8-field verdict JSON. Your agent acts — hedge, accumulate, or ignore.",
  },
];

export function PricingCTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-12 lg:p-16">
          <div className="bg-dotmatrix pointer-events-none absolute inset-0 opacity-50" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-verdict-bull/10 blur-3xl" />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-widest text-verdict-bull">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Pay per call. Not per month.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground sm:text-lg">
              FUD.ai isn&apos;t a subscription. Every analysis is a single on-chain micropayment of just <strong className="text-foreground">$0.02 in USDC</strong>, settled through the CROO CAP protocol. Any agent can hire FUD.ai as a dependency — no contract, no minimums.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title} className="relative rounded-2xl border border-border bg-surface-2 p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-verdict-bull">
                      <s.icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <LinkButton
                href={CROO_HIRE_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
                className="relative overflow-hidden px-5 py-2.5 text-sm"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Hire on CROO Agent Store
                </span>
                <span className="shine-sweep pointer-events-none absolute inset-y-0 -left-[120%] w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/25" />
              </LinkButton>
              <p className="text-xs text-muted-foreground">
                Callable by any agent · settlement on Base · USDC
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
