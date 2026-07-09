"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { BookText, ExternalLink, Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LinkButton } from "./ui/button";
import { cn } from "../lib/utils";

const CROO_LISTING = "https://agent.croo.network";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || menuOpen
          ? "border-b border-border/50 bg-background/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo — icon + text on ALL breakpoints */}
        <a href="/" className="flex items-center gap-1.5">
          <Image
            src="/LOGOFUD.svg"
            alt="FUD.ai logo"
            width={40}
            height={40}
            priority
            className="h-10 w-10 shrink-0"
          />
          <span className="text-xl font-bold tracking-tight">
            FUD<span className="text-verdict-bull">.ai</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/docs"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
          >
            Hire on CROO Agent Store
            <ExternalLink className="h-3.5 w-3.5" />
          </LinkButton>
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong md:hidden"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      {/* Mobile dropdown sheet — animated */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
              {/* Docs + Theme toggle — inline row */}
              <div className="flex w-full items-center justify-between rounded-lg px-3 py-3">
                <a
                  href="/docs"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <BookText className="h-4 w-4" />
                  Docs
                </a>
                <ThemeToggle />
              </div>
              {/* Hire button — full row */}
              <a
                href={CROO_LISTING}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-between rounded-lg border border-border-strong px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                Hire on CROO Agent Store
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
