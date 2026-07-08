import { Bot, Gauge } from "lucide-react";

const cards = [
  {
    icon: Bot,
    title: "General AI (ChatGPT / Claude / Gemini)",
    points: [
      "Analisis dari data statis yang ter-train di masa lalu.",
      "Tidak baca sinyal on-chain secara real-time.",
      "Tidak bisa bedakan FUD organik dari kampanye terkoordinasi.",
      "Tidak punya akses ke smart contract, order book, atau flow wallet.",
    ],
    tone: "neutral" as const,
  },
  {
    icon: Gauge,
    title: "Sentiment Aggregator (LunarCrush / Santiment-style)",
    points: [
      "Hanya agregasi skor sentimen sosial.",
      "Tidak ada deteksi eksplisit pola sybil atau koordinasi bot.",
      "Tidak grounded ke data kontrak on-chain — raw signal tanpa cross-validation.",
      "Tidak ada memori antar-query, tidak ada self-correction.",
    ],
    tone: "neutral" as const,
  },
];

export function WhyGeneralAI() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-verdict-bull">
            The problem
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Why general AI doesn&apos;t work in crypto
          </h2>
          <p className="mt-4 text-muted-foreground sm:text-lg">
            Crypto manipulation moves faster than any chatbot can read. Here&apos;s what
            existing tools miss.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          {cards.map((c) => (
            <div
              key={c.title}
              className="group relative rounded-2xl border border-border bg-surface p-7 transition-all duration-300 hover:border-border-strong hover:bg-surface-2"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted-foreground">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold leading-snug">{c.title}</h3>
              <ul className="mt-5 space-y-3">
                {c.points.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-verdict-neutral/70" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">FUD.ai</span> closes every gap
          above — on-chain grounding, explicit coordination detection, multi-branch
          reasoning, and a reflexion loop that learns from past misses.
        </p>
      </div>
    </section>
  );
}
