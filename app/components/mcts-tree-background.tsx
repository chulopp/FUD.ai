export function MCTSTreeBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="mcts-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--verdict-bull)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--verdict-bull)" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="mcts-node" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--verdict-bull)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--verdict-bull)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Root nodes spread across top */}
        {/* Level 0 — 5 nodes at top */}
        <g stroke="url(#mcts-line)" strokeWidth="1">
          {/* Branches from top nodes converging downward */}
          <path d="M 120 80 L 300 240" />
          <path d="M 300 80 L 300 240" />
          <path d="M 300 80 L 480 240" />
          <path d="M 480 80 L 480 240" />
          <path d="M 480 80 L 660 240" />
          <path d="M 660 80 L 660 240" />
          <path d="M 660 80 L 840 240" />
          <path d="M 840 80 L 840 240" />
          <path d="M 840 80 L 1020 240" />
          <path d="M 1020 80 L 1020 240" />
          <path d="M 1080 80 L 1020 240" />
        </g>

        {/* Level 1 → Level 2 (further convergence) */}
        <g stroke="url(#mcts-line)" strokeWidth="1">
          <path d="M 300 240 L 420 400" />
          <path d="M 480 240 L 420 400" />
          <path d="M 480 240 L 600 400" />
          <path d="M 660 240 L 600 400" />
          <path d="M 660 240 L 780 400" />
          <path d="M 840 240 L 780 400" />
          <path d="M 840 240 L 900 400" />
          <path d="M 1020 240 L 900 400" />
        </g>

        {/* Level 2 → Level 3 (converging to center) */}
        <g stroke="url(#mcts-line)" strokeWidth="1.2">
          <path d="M 420 400 L 600 560" />
          <path d="M 600 400 L 600 560" />
          <path d="M 600 400 L 660 560" />
          <path d="M 780 400 L 660 560" />
          <path d="M 780 400 L 720 560" />
          <path d="M 900 400 L 720 560" />
        </g>

        {/* Final convergence to single point at bottom center (toward JSON output) */}
        <g stroke="var(--verdict-bull)" strokeWidth="1.5" opacity="0.08">
          <path d="M 600 560 L 660 680" />
          <path d="M 660 560 L 660 680" />
          <path d="M 720 560 L 660 680" />
        </g>

        {/* Nodes — Level 0 (top, spread wide) */}
        <g fill="url(#mcts-node)">
          <circle cx="120" cy="80" r="5" />
          <circle cx="300" cy="80" r="5" />
          <circle cx="480" cy="80" r="5" />
          <circle cx="660" cy="80" r="5" />
          <circle cx="840" cy="80" r="5" />
          <circle cx="1020" cy="80" r="5" />
          <circle cx="1080" cy="80" r="5" />
        </g>

        {/* Nodes — Level 1 */}
        <g fill="url(#mcts-node)" opacity="0.8">
          <circle cx="300" cy="240" r="4.5" />
          <circle cx="480" cy="240" r="4.5" />
          <circle cx="660" cy="240" r="4.5" />
          <circle cx="840" cy="240" r="4.5" />
          <circle cx="1020" cy="240" r="4.5" />
        </g>

        {/* Nodes — Level 2 */}
        <g fill="url(#mcts-node)" opacity="0.7">
          <circle cx="420" cy="400" r="4" />
          <circle cx="600" cy="400" r="4" />
          <circle cx="780" cy="400" r="4" />
          <circle cx="900" cy="400" r="4" />
        </g>

        {/* Nodes — Level 3 (converging) */}
        <g fill="url(#mcts-node)" opacity="0.6">
          <circle cx="600" cy="560" r="4" />
          <circle cx="660" cy="560" r="4" />
          <circle cx="720" cy="560" r="4" />
        </g>

        {/* Final node — convergence point (toward JSON output box) */}
        <g>
          <circle
            cx="660"
            cy="680"
            r="7"
            fill="var(--verdict-bull)"
            opacity="0.1"
          />
          <circle
            cx="660"
            cy="680"
            r="12"
            fill="none"
            stroke="var(--verdict-bull)"
            strokeWidth="1"
            opacity="0.06"
          />
        </g>

        {/* Subtle branch labels */}
        <g
          fill="var(--verdict-bull)"
          opacity="0.06"
          fontSize="11"
          fontFamily="var(--font-jetbrains-mono), monospace"
        >
          <text x="250" y="395">A</text>
          <text x="590" y="395">B</text>
          <text x="880" y="395">C</text>
        </g>
      </svg>
    </div>
  );
}
