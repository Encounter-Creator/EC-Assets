"use client";

import { DecypherText } from "@/components/decypher-text";
import { MatrixRain } from "@/components/matrix-rain";

export function WorkspaceLoader({ subtitle = "Loading workspace" }: { subtitle?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <MatrixRain className="opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_24%)]" />
      <div className="z-10 rounded-[1.8rem] border border-primary/20 bg-background/58 px-6 py-5 text-center shadow-[var(--shadow-strong)] backdrop-blur-sm">
        <div className="font-display text-2xl uppercase tracking-[0.24em] text-primary glow md:text-4xl">
          <DecypherText />
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.32em] text-primary/45">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
