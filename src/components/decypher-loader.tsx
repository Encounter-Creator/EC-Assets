"use client";

import { useEffect, useState } from "react";

import { DecypherText } from "@/components/decypher-text";
import { MatrixRain } from "@/components/matrix-rain";

export function DecypherLoader({
  isReady,
  onComplete,
}: {
  isReady: boolean;
  onComplete: () => void;
}) {
  const targetText = "DECIPHERING CODE...";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"raining" | "decoding" | "fade">("raining");

  useEffect(() => {
    if (isReady && phase === "raining") {
      const timer = window.setTimeout(() => setPhase("decoding"), 40);
      return () => window.clearTimeout(timer);
    }
  }, [isReady, phase]);

  useEffect(() => {
    if (phase !== "decoding") return;

    let iteration = 0;
    const interval = window.setInterval(() => {
      setText(
        targetText
          .split("")
          .map((letter, index) => {
            if (index < iteration) return targetText[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join(""),
      );

      if (iteration >= targetText.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setPhase("fade"), 40);
      }

      iteration += 1;
    }, 12);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === "fade") {
      const timer = window.setTimeout(onComplete, 70);
      return () => window.clearTimeout(timer);
    }
  }, [onComplete, phase]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        phase === "fade" ? "opacity-0" : "opacity-100"
      }`}
    >
      <MatrixRain className="opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_24%)]" />

      <div className="z-10 rounded-[1.8rem] border border-primary/20 bg-background/58 px-6 py-5 text-center shadow-[var(--shadow-strong)] backdrop-blur-sm">
        <div className="font-display text-2xl uppercase tracking-[0.24em] text-primary glow md:text-4xl">
          {phase === "raining" ? <DecypherText /> : text}
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.32em] text-primary/45">
          Initializing access shell
        </div>
      </div>
    </div>
  );
}
