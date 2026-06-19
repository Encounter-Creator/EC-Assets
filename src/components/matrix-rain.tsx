"use client";

import { useEffect, useRef } from "react";

export function MatrixRain({
  className = "",
  interactive = false,
}: {
  className?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const fontSize = 16;
    const pauseRadius = 120;
    const fullStopRadius = 36;
    let columns = Math.floor(width / fontSize);
    let drops = Array(columns)
      .fill(1)
      .map(() => Math.random() * -50);
    const pointer = { x: -9999, y: -9999, active: false };

    const chars = "01";

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      columns = Math.floor(width / fontSize);
      drops = Array(columns)
        .fill(1)
        .map(() => Math.random() * -50);
    };

    const move = (event: PointerEvent) => {
      if (!interactive) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };

    const leave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
      pointer.active = false;
    };

    window.addEventListener("resize", resize);
    if (interactive) {
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerleave", leave);
    }

    let raf = 0;
    let last = 0;
    const interval = 1000 / 24;

    const draw = (now: number) => {
      raf = window.requestAnimationFrame(draw);
      if (now - last < interval) return;
      last = now;

      ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < columns; i += 1) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        let speed = 1;

        if (interactive && pointer.active) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < pauseRadius) {
            speed = Math.max(0, (distance - fullStopRadius) / (pauseRadius - fullStopRadius));
          }
        }

        ctx.fillStyle = "#CCFFCC";
        ctx.shadowColor = "#00FF41";
        ctx.shadowBlur = 8;
        ctx.fillText(text, x, y);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#00B82D";
        ctx.fillText(text, x, y - fontSize);

        if (y > height && Math.random() > 0.975 && speed > 0.1) {
          drops[i] = 0;
        }

        drops[i] += speed;
      }
    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (interactive) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerleave", leave);
      }
    };
  }, [interactive]);

  return <canvas ref={ref} className={`fixed inset-0 -z-10 bg-background ${className}`} aria-hidden="true" />;
}
