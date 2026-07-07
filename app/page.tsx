import Image from "next/image";
import { EvidenceItem } from "./lib/mcts/pipeline";

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  return (
    <div className="w-full mt-4 p-4 border border-zinc-200 rounded-lg dark:border-zinc-800">
      <h3 className="text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-100">Evidence Chain Weights Check:</h3>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-4 p-2 rounded bg-zinc-100 dark:bg-zinc-900">
            <span>{item.evidence}</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
              Weight: {(item.weight).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Sample mock data to satisfy type checking and demonstrate rendering
const sampleEvidence: EvidenceItem[] = [
  { evidence: "[SECURITY] Hostile prompt injection attempt detected on Twitter", weight: 0.20 },
  { evidence: "[SYBIL] Coordinated bot network detected: unique_author_ratio is 0.15", weight: 0.35 },
  { evidence: "[RUGCHECK] Solana risk score is 75/100", weight: 0.45 }
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left w-full">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <EvidenceList items={sampleEvidence} />
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
