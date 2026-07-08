import { Check, X } from "lucide-react";

const rows = [
  {
    criterion: "Focus",
    general: "AI umum — crypto cuma salah satu topik dari ribuan.",
    aggregator: "Agregasi skor sentimen sosial mentah.",
    fud: "Spesialis deteksi manipulasi & rugpull. Epistemic reasoning multi-cabang.",
  },
  {
    criterion: "Deteksi koordinasi / sybil",
    general: "Tidak ada.",
    aggregator: "Umumnya tidak eksplisit.",
    fud: "Modul eksplisit: author ratio, account age, duplicate-text clustering, burst windows.",
  },
  {
    criterion: "Grounding on-chain",
    general: "Tidak punya akses on-chain.",
    aggregator: "Terbatas / tidak konsisten.",
    fud: "Cross-validated dengan RugCheck, GoPlus, DexScreener, order book real-time.",
  },
  {
    criterion: "Self-correction",
    general: "Tidak ada memori antar-query.",
    aggregator: "Tidak ada.",
    fud: "Reflexion Loop — belajar dari prediksi salah, kalibrasi confidence otomatis.",
  },
  {
    criterion: "Model bisnis",
    general: "Berlangganan / API generik.",
    aggregator: "Berlangganan.",
    fud: "Pay-per-call via USDC lewat CROO CAP. Agent lain bisa hire sebagai dependency.",
  },
  {
    criterion: "Akses agent-to-agent",
    general: "Tidak native.",
    aggregator: "Tidak native.",
    fud: "Native — callable langsung oleh bot/agent lain, settlement on-chain.",
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
            A side-by-side view across the criteria that actually matter when the market
            turns.
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
                      <span>{r.fud}</span>
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
                <MobileRow label="FUD.ai" value={r.fud} ok />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
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
      <p className={`mt-1.5 text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
