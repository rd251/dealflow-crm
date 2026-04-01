import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 60
): SwipeHandlers {
  const startX = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(diff) >= threshold) {
      if (diff > 0) onSwipeRight();
      else onSwipeLeft();
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchEnd };
}
