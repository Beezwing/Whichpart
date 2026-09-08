"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;

/**
 * A minimal, dependency-free guided tour: dims everything except the
 * current step's real target element (found live via `selector`, not a
 * screenshot or a copy of the UI), with a tooltip card next to it.
 *
 * Every step targets something that's actually on screen right now --
 * the nav bar or the supplier tab strip -- so this never needs to
 * navigate the user across pages to keep the tour going.
 */
export function ProductTour({
  tourId,
  steps,
  onDone,
}: {
  tourId: string;
  steps: TourStep[];
  onDone: () => void;
}) {
  const { refresh } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const finishing = useRef(false);

  const step = steps[stepIndex];

  useEffect(() => {
    let missCount = 0;

    function measure() {
      const el = step ? document.querySelector(step.selector) : null;
      if (!el) {
        setRect(null);
        // Give the DOM a couple of measure passes (layout can lag a tick
        // behind a step change) before concluding the target genuinely
        // isn't there and skipping past it.
        missCount += 1;
        if (missCount > 2) {
          if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
          else void finish();
        }
        return;
      }
      missCount = 0;
      const r = el.getBoundingClientRect();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    // Re-measure shortly after in case scrollIntoView is still animating,
    // and keep it in sync with resize/scroll while this step is showing.
    const t = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await api.post(`/auth/tours/${tourId}/seen`);
    } catch {
      /* best-effort -- worst case the tour offers itself again next visit */
    }
    await refresh();
    onDone();
  }

  // Nothing to point at yet (this step's element isn't on screen, or the
  // tour already finished) -- render nothing rather than a tooltip
  // pointing at nothing. The measure effect above decides whether to
  // move to the next step or end the tour.
  if (!step || !rect) return null;

  const isLast = stepIndex === steps.length - 1;
  const spot = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  // Tooltip goes below the target by default, flips above if there's not
  // enough room under it.
  const tooltipBelow = spot.top + spot.height + 160 < window.innerHeight;
  const tooltipTop = tooltipBelow ? spot.top + spot.height + 12 : Math.max(12, spot.top - 12 - 150);
  const tooltipLeft = Math.min(Math.max(12, spot.left), window.innerWidth - 320);

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* four-panel dim overlay leaves the target rect itself untouched */}
      <div
        className="fixed bg-black/60"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }}
        onClick={() => void finish()}
      />
      <div
        className="fixed bg-black/60"
        style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }}
        onClick={() => void finish()}
      />
      <div
        className="fixed bg-black/60"
        style={{ top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }}
        onClick={() => void finish()}
      />
      <div
        className="fixed bg-black/60"
        style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }}
        onClick={() => void finish()}
      />
      {/* highlight ring around the real element */}
      <div
        className="pointer-events-none fixed rounded-lg ring-2 ring-[var(--gold)]"
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
      />

      <div
        className="fixed w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <p className="mb-1 font-semibold">{step.title}</p>
        <p className="mb-4 text-sm text-[var(--muted)]">{step.body}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => void finish()}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => i - 1)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/20"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? void finish() : setStepIndex((i) => i + 1))}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)]"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
