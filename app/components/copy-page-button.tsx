"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyPageButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy page as markdown"
      title="Copy page as markdown"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      {copied ? (
        <Check className="h-4 w-4 text-verdict-bull" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
