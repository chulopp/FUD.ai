"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookText, ExternalLink } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LinkButton } from "./ui/button";
import { cn } from "../lib/utils";

const CROO_LISTING = "https://agent.croo.network";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <Image
            src="/LOGOFUD.svg"
            alt="FUD.ai logo"
            width={32}
            height={32}
            priority
            className="h-8 w-8 shrink-0"
          />
          <span className="text-lg font-bold tracking-tight">
            FUD<span className="text-verdict-bull">.ai</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/docs"
            className="hidden items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <BookText className="h-4 w-4" />
            Docs
          </a>
          <LinkButton
            href={CROO_LISTING}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
          >
            List on CROO Agent Store
            <ExternalLink className="h-3.5 w-3.5" />
          </LinkButton>
          <LinkButton
            href={CROO_LISTING}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            size="sm"
            className="sm:hidden"
          >
            CROO
            <ExternalLink className="h-3.5 w-3.5" />
          </LinkButton>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
