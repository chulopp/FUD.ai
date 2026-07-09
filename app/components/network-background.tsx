export function NetworkBackground() {
  /*
   * Constellation-style neural network (inspired by Aura).
   * ─ Nodes scattered across the full viewport
   * ─ Straight lines connecting nearby nodes
   * ─ Lines pass through / connect at 4 floating-card anchors:
   *     TL ≈ (140, 170)   TR ≈ (1300, 190)
   *     BL ≈ (150, 730)   BR ≈ (1290, 710)
   */
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        className="h-full w-full"
      >
        {/* ── Connection lines ── */}
        <g stroke="var(--net-line)" strokeWidth="1" fill="none" opacity="0.18">
          {/* Top-left cluster connections */}
          <line x1="40" y1="80" x2="140" y2="170" />
          <line x1="140" y1="170" x2="260" y2="110" />
          <line x1="140" y1="170" x2="80" y2="290" />
          <line x1="140" y1="170" x2="310" y2="240" />
          <line x1="260" y1="110" x2="420" y2="60" />
          <line x1="80" y1="290" x2="150" y2="430" />
          <line x1="310" y1="240" x2="480" y2="190" />

          {/* Top-right cluster connections */}
          <line x1="1300" y1="190" x2="1400" y2="90" />
          <line x1="1300" y1="190" x2="1180" y2="120" />
          <line x1="1300" y1="190" x2="1370" y2="310" />
          <line x1="1300" y1="190" x2="1130" y2="260" />
          <line x1="1180" y1="120" x2="1020" y2="70" />
          <line x1="1130" y1="260" x2="980" y2="200" />
          <line x1="1370" y1="310" x2="1350" y2="450" />

          {/* Bottom-left cluster connections */}
          <line x1="150" y1="730" x2="60" y2="820" />
          <line x1="150" y1="730" x2="270" y2="800" />
          <line x1="150" y1="730" x2="90" y2="610" />
          <line x1="150" y1="730" x2="300" y2="660" />
          <line x1="150" y1="430" x2="150" y2="730" />
          <line x1="300" y1="660" x2="440" y2="720" />

          {/* Bottom-right cluster connections */}
          <line x1="1290" y1="710" x2="1390" y2="800" />
          <line x1="1290" y1="710" x2="1160" y2="790" />
          <line x1="1290" y1="710" x2="1360" y2="590" />
          <line x1="1290" y1="710" x2="1120" y2="650" />
          <line x1="1350" y1="450" x2="1290" y2="710" />
          <line x1="1120" y1="650" x2="960" y2="710" />

          {/* Cross-connections between card zones */}
          <line x1="420" y1="60" x2="1020" y2="70" />
          <line x1="480" y1="190" x2="980" y2="200" />
          <line x1="440" y1="720" x2="960" y2="710" />
          <line x1="310" y1="240" x2="300" y2="660" />
          <line x1="1130" y1="260" x2="1120" y2="650" />

          {/* Scattered ambient connections */}
          <line x1="560" y1="40" x2="680" y2="100" />
          <line x1="680" y1="100" x2="820" y2="60" />
          <line x1="820" y1="60" x2="900" y2="110" />
          <line x1="500" y1="830" x2="660" y2="790" />
          <line x1="660" y1="790" x2="800" y2="840" />
          <line x1="800" y1="840" x2="960" y2="710" />
        </g>

        {/* ── Solid dots (nodes) ── */}
        <g fill="var(--net-node)">
          {/* Card anchor nodes (larger) */}
          <circle cx="140" cy="170" r="3.5" />
          <circle cx="1300" cy="190" r="3.5" />
          <circle cx="150" cy="730" r="3.5" />
          <circle cx="1290" cy="710" r="3.5" />

          {/* Top-left area */}
          <circle cx="40" cy="80" r="2" />
          <circle cx="260" cy="110" r="2.5" />
          <circle cx="80" cy="290" r="2" />
          <circle cx="310" cy="240" r="2.5" />
          <circle cx="420" cy="60" r="2" />
          <circle cx="150" cy="430" r="2" />
          <circle cx="480" cy="190" r="2" />

          {/* Top-right area */}
          <circle cx="1400" cy="90" r="2" />
          <circle cx="1180" cy="120" r="2.5" />
          <circle cx="1370" cy="310" r="2" />
          <circle cx="1130" cy="260" r="2.5" />
          <circle cx="1020" cy="70" r="2" />
          <circle cx="980" cy="200" r="2" />
          <circle cx="1350" cy="450" r="2" />

          {/* Bottom-left area */}
          <circle cx="60" cy="820" r="2" />
          <circle cx="270" cy="800" r="2.5" />
          <circle cx="90" cy="610" r="2" />
          <circle cx="300" cy="660" r="2.5" />
          <circle cx="440" cy="720" r="2" />

          {/* Bottom-right area */}
          <circle cx="1390" cy="800" r="2" />
          <circle cx="1160" cy="790" r="2.5" />
          <circle cx="1360" cy="590" r="2" />
          <circle cx="1120" cy="650" r="2.5" />
          <circle cx="960" cy="710" r="2" />

          {/* Top/bottom ambient scatter */}
          <circle cx="560" cy="40" r="1.5" />
          <circle cx="680" cy="100" r="2" />
          <circle cx="820" cy="60" r="1.5" />
          <circle cx="900" cy="110" r="2" />
          <circle cx="500" cy="830" r="1.5" />
          <circle cx="660" cy="790" r="2" />
          <circle cx="800" cy="840" r="1.5" />

          {/* Extra floating dots (no connections, just atmosphere) */}
          <circle cx="350" cy="380" r="1.5" />
          <circle cx="1100" cy="400" r="1.5" />
          <circle cx="380" cy="540" r="1.5" />
          <circle cx="1080" cy="520" r="1.5" />
          <circle cx="620" cy="160" r="1.5" />
          <circle cx="850" cy="150" r="1.5" />
          <circle cx="580" cy="760" r="1.5" />
          <circle cx="870" cy="750" r="1.5" />
        </g>

        {/* ── Hollow ring nodes at card anchors ── */}
        <g stroke="var(--net-node)" strokeWidth="1" fill="none" opacity="0.35">
          <circle cx="140" cy="170" r="7" />
          <circle cx="1300" cy="190" r="7" />
          <circle cx="150" cy="730" r="7" />
          <circle cx="1290" cy="710" r="7" />
          {/* Secondary rings at key junctions */}
          <circle cx="260" cy="110" r="5" />
          <circle cx="1180" cy="120" r="5" />
          <circle cx="300" cy="660" r="5" />
          <circle cx="1120" cy="650" r="5" />
          <circle cx="680" cy="100" r="4.5" />
          <circle cx="820" cy="60" r="4.5" />
          <circle cx="660" cy="790" r="4.5" />
        </g>

        {/* ── Accent dots (green tint) at card anchors ── */}
        <g fill="var(--net-accent)" opacity="0.6">
          <circle cx="140" cy="170" r="2" />
          <circle cx="1300" cy="190" r="2" />
          <circle cx="150" cy="730" r="2" />
          <circle cx="1290" cy="710" r="2" />
        </g>
      </svg>
    </div>
  );
}
