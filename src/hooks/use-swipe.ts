
import { useState, useRef, useEffect } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeOptions {
  threshold?: number;
  preventDefault?: boolean;
}

export const useSwipe = (
  elementRef: React.RefObject<HTMLElement>,
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) => {
  const { threshold = 50, preventDefault = true } = options;
  
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      setIsSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startX.current || !startY.current) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = endX - startX.current;
      const diffY = endY - startY.current;
      
      const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);

      if (isHorizontalSwipe) {
        if (diffX > threshold && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        } else if (diffX < -threshold && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        }
      } else {
        if (diffY > threshold && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        } else if (diffY < -threshold && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        }
      }

      startX.current = null;
      startY.current = null;
      setIsSwiping(false);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handlers, preventDefault, threshold]);

  return { isSwiping };
};
