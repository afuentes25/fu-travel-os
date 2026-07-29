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

export function lavellaSlideIndex(
  current: number,
  step: number,
  slideCount: number,
) {
  if (slideCount < 2) return 0;
  return (current + step + slideCount) % slideCount;
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
