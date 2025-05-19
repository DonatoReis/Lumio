
import { useRef, useEffect } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minSwipeDistance?: number;
}

export const useSwipe = (options: SwipeOptions) => {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, minSwipeDistance = 50 } = options;
  
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const touchEndRef = useRef<{ x: number, y: number } | null>(null);

  // Esta função lida com o início do toque
  const handleTouchStart = (e: TouchEvent) => {
    touchStartRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  };

  // Esta função lida com o movimento do toque
  const handleTouchMove = (e: TouchEvent) => {
    touchEndRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  };

  // Esta função lida com o fim do toque e determina a direção
  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    
    const distanceX = touchEndRef.current.x - touchStartRef.current.x;
    const distanceY = touchEndRef.current.y - touchStartRef.current.y;
    
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    
    if (isHorizontalSwipe) {
      // Swipe horizontal
      if (distanceX > minSwipeDistance) {
        onSwipeRight?.();
      } else if (distanceX < -minSwipeDistance) {
        onSwipeLeft?.();
      }
    } else {
      // Swipe vertical
      if (distanceY > minSwipeDistance) {
        onSwipeDown?.();
      } else if (distanceY < -minSwipeDistance) {
        onSwipeUp?.();
      }
    }
    
    // Resetar referências
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  return {
    bindSwipeEvents: (element: HTMLElement | null) => {
      if (!element) return;
      
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchmove', handleTouchMove);
      element.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    }
  };
};
