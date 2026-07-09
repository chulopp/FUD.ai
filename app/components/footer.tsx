import Image from "next/image";
import { BookText, ExternalLink } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.11-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const CROO_LISTING = "https://agent.croo.network";
const GITHUB_URL = "https://github.com/chulopp/FUD.ai";

const links = [
  {
    title: "Product",
    items: [
      { label: "Docs", href: "/docs" },
      { label: "Live demo", href: "#live-demo" },
      { label: "How it works", href: "#about" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "CROO Agent Store", href: CROO_LISTING, external: true },
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "API Reference", href: "/docs/api-reference" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/LOGOFUD.svg"
                alt="FUD.ai logo"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0"
              />
              <span className="text-xl font-bold tracking-tight">
                FUD<span className="text-verdict-bull">.ai</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Agentic on-chain intelligence that detects coordinated FUD and rug-pull
              manipulation in real time. Built on CROO CAP.
            </p>
          </div>

          {links.map((group) => (
            <div key={group.title}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {group.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      {...(item.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                      {item.external && <ExternalLink className="h-3 w-3" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Connect
            </p>
            <div className="mt-4 flex gap-2.5">
              <a
                href="https://x.com/fuddulu"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
              <a
                href="/docs"
                aria-label="Documentation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
              >
                <BookText className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} FUD.ai. Open source under MIT.</p>
          <p className="font-mono">
            Built on CROO CAP • settlement on Base
          </p>
        </div>
      </div>
    </footer>
  );
}
