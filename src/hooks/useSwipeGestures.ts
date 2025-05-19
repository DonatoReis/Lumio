
import { useRef, useEffect } from 'react';

type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface UseSwipeGesturesOptions {
  threshold?: number;
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export const useSwipeGestures = (
  ref: React.RefObject<HTMLElement>,
  options: UseSwipeGesturesOptions = {}
) => {
  const {
    threshold = 50,
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options;

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = endX - startX.current;
      const diffY = endY - startY.current;

      // Determinar a direção principal do swipe
      const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);

      if (isHorizontalSwipe) {
        if (Math.abs(diffX) < threshold) return;
        
        if (diffX > 0) {
          // Swipe da esquerda para direita
          if (onSwipe) onSwipe('right');
          if (onSwipeRight) onSwipeRight();
        } else {
          // Swipe da direita para esquerda
          if (onSwipe) onSwipe('left');
          if (onSwipeLeft) onSwipeLeft();
        }
      } else {
        if (Math.abs(diffY) < threshold) return;
        
        if (diffY > 0) {
          // Swipe de cima para baixo
          if (onSwipe) onSwipe('down');
          if (onSwipeDown) onSwipeDown();
        } else {
          // Swipe de baixo para cima
          if (onSwipe) onSwipe('up');
          if (onSwipeUp) onSwipeUp();
        }
      }

      // Reset
      startX.current = null;
      startY.current = null;
    };

    // Adicionar event listeners
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchend', handleTouchEnd);

    // Cleanup
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, threshold, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);
};
