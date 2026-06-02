"use client";

import { cn } from "@/lib/utils";

export function DecypherText({
  text = "DECIPHERING CODE",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("matrix-loader-text", className)} aria-label={text}>
      {text.split("").map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={cn("loader-letter", letter === " " && "w-[0.45em]")}
          style={{ animationDelay: `${0.1 + index * 0.105}s` }}
          aria-hidden="true"
        >
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
      <span className="cursor-blink" aria-hidden="true" />
      <div className="loader" aria-hidden="true" />
    </div>
  );
}
