export type SliderPauseReason =
  | "hover"
  | "focus"
  | "interaction"
  | "hidden"
  | "reduced-motion";

export const LAVELLA_SLIDER_TIMING = {
  autoplayDelayMs: 5000,
  transitionDurationMs: 650,
  resumeAfterInteractionMs: 7000,
} as const;

export function subscribeLavellaMediaQuery(
  media: MediaQueryList,
  listener: () => void,
) {
  if (
    typeof media.addEventListener === "function" &&
    typeof media.removeEventListener === "function"
  ) {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  if (
    typeof media.addListener === "function" &&
    typeof media.removeListener === "function"
  ) {
    media.addListener(listener);
    return () => media.removeListener(listener);
  }
  return () => undefined;
}

export function lavellaSlideIndex(
  current: number,
  step: number,
  slideCount: number,
) {
  if (slideCount < 2) return 0;
  return (current + step + slideCount) % slideCount;
}

export function lavellaRailTarget({
  currentScroll,
  maxScroll,
  itemStep,
  direction,
}: {
  currentScroll: number;
  maxScroll: number;
  itemStep: number;
  direction: -1 | 1;
}) {
  if (maxScroll <= 0) return 0;
  if (direction < 0 && currentScroll <= itemStep / 2) return maxScroll;
  if (direction > 0 && currentScroll >= maxScroll - 1) return 0;
  return Math.min(
    maxScroll,
    Math.max(0, currentScroll + direction * itemStep),
  );
}

export function updateLavellaPauseReasons(
  current: ReadonlySet<SliderPauseReason>,
  reason: SliderPauseReason,
  paused: boolean,
) {
  if (current.has(reason) === paused) return current;
  const next = new Set(current);
  if (paused) next.add(reason);
  else next.delete(reason);
  return next;
}

export function updateLavellaHoverPause(
  current: ReadonlySet<SliderPauseReason>,
  paused: boolean,
  hoverCapable: boolean,
) {
  return updateLavellaPauseReasons(
    current,
    "hover",
    hoverCapable && paused,
  );
}

export function canLavellaAutoplay({
  autoplay,
  slideCount,
  pauseReasons,
}: {
  autoplay: boolean;
  slideCount: number;
  pauseReasons: ReadonlySet<SliderPauseReason>;
}) {
  return autoplay && slideCount > 1 && pauseReasons.size === 0;
}
