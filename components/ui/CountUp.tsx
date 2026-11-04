"use client";

import { useEffect, useState } from "react";

export function CountUp({
  to,
  duration = 1.2,
  decimals = 0,
  suffix = "",
  className = "",
}: {
  to: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (isNaN(to) || to <= 0) {
      setCurrent(0);
      return;
    }

    const start = 0;
    const end = to;
    const startTime = performance.now();
    const durationMs = duration * 1000;

    let frameId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = start + (end - start) * eased;
      setCurrent(val);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCurrent(end);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [to, duration]);

  const display =
    decimals > 0
      ? current.toFixed(decimals)
      : Math.floor(current).toLocaleString();

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}
