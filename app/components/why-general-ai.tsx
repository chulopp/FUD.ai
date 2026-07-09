const cards = [
  {
    badge: "CHATGPT, GEMINI, CLAUDE",
    title: "General AI runs on stale data.",
    description: "By the time a general LLM analyzes yesterday's news, whales have already dumped on retail. With zero real-time access to smart contracts or wallet flows, you are literally trading on ancient history.",
  },
  {
    badge: "LUNARCRUSH, SANTIMENT, SOCIAL TOOLS",
    title: "Sentiment trackers are easily played.",
    description: "Counting a million bot tweets isn't 'sentiment analysis' — it's measuring a Sybil attack. They blindly aggregate social scores without cross-validating on-chain money flow. If the bots cheer, these tools tell you to buy the dump.",
  },
];

export function WhyGeneralAI() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Why general AI <span className="text-rose-500">doesn&apos;t work</span> in crypto sentiment
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-8 md:grid-cols-2">
          {cards.map((c) => (
            <div
              key={c.title}
              className="group relative rounded-2xl border border-border bg-surface p-7 sm:p-9 transition-all duration-300 hover:border-border-strong hover:bg-surface-2"
            >
              <span className="inline-block border border-border/50 text-muted-foreground text-xs font-semibold tracking-wider px-3 py-1 rounded-full uppercase mb-4">
                {c.badge}
              </span>
              <h3 className="mb-3 text-2xl font-bold leading-snug">{c.title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                {c.description}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">FUD.ai</span> closes every gap
          above — on-chain grounding, explicit coordination detection, multi-branch
          reasoning, and a reflexion loop that learns from past misses.
        </p>
      </div>
    </section>
  );
}

