import { useState, useEffect, useRef, RefObject, useCallback } from 'react';

/**
 * Options for configuring the useMousePosition hook
 */
interface UseMousePositionOptions {
  /**
   * Whether to listen for mouse events outside the element
   * When true, the hook will track the mouse even when it leaves the container
   */
  trackOutside?: boolean;
  
  /**
   * Delay in milliseconds between position updates for throttling
   * Set to 0 to disable throttling
   */
  throttleMs?: number;
  
  /**
   * Initial position before any mouse movement is detected
   */
  initialPosition?: { x: number; y: number };
}

/**
 * Type for the returned mouse position coordinates
 */
interface NormalizedPosition {
  /**
   * X-coordinate in the range [-1, 1], where 0 is the center
   */
  x: number;
  
  /**
   * Y-coordinate in the range [-1, 1], where 0 is the center
   */
  y: number;
  
  /**
   * Whether the mouse is currently inside the tracked element
   */
  isInside: boolean;
}

/**
 * Custom hook that tracks mouse position relative to a container element
 * and returns normalized coordinates (-1 to 1) where (0,0) is the center.
 * 
 * @param elementRef - React ref pointing to the container element to track mouse position against
 * @param options - Configuration options for the hook
 * @returns Normalized mouse position with x and y coordinates in [-1, 1] range
 */
export function useMousePosition(
  elementRef: RefObject<HTMLElement>,
  options: UseMousePositionOptions = {}
): NormalizedPosition {
  const {
    trackOutside = false,
    throttleMs = 0,
    initialPosition = { x: 0, y: 0 }
  } = options;

  // State for normalized mouse position
  const [position, setPosition] = useState<NormalizedPosition>({
    ...initialPosition,
    isInside: false
  });
  
  // Timestamp for throttling
  const lastUpdateRef = useRef(0);
  
  // Throttled function to update position
  const updatePosition = useCallback(
    (newPosition: NormalizedPosition) => {
      const now = Date.now();
      
      if (throttleMs === 0 || now - lastUpdateRef.current >= throttleMs) {
        setPosition(newPosition);
        lastUpdateRef.current = now;
      }
    },
    [throttleMs]
  );
  
  // Handle mouse movement
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!elementRef.current) return;
      
      const rect = elementRef.current.getBoundingClientRect();
      
      // Calculate the center of the element
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate normalized coordinates (-1 to 1)
      const x = ((event.clientX - centerX) / (rect.width / 2));
      const y = ((event.clientY - centerY) / (rect.height / 2));
      
      // Check if the mouse is inside the element
      const isInside = 
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      
      updatePosition({ x, y, isInside });
    },
    [elementRef, updatePosition]
  );

  // Handle when mouse leaves the element
  const handleMouseLeave = useCallback(() => {
    if (!trackOutside) {
      // If not tracking outside, reset to initial position
      setPosition({ ...initialPosition, isInside: false });
    } else {
      // If tracking outside, just update isInside status
      setPosition(prev => ({ ...prev, isInside: false }));
    }
  }, [initialPosition, trackOutside]);

  // Set up event listeners
  useEffect(() => {
    const element = trackOutside ? window : elementRef.current;
    
    if (element) {
      element.addEventListener('mousemove', handleMouseMove);
      
      if (!trackOutside && elementRef.current) {
        elementRef.current.addEventListener('mouseleave', handleMouseLeave);
      }
      
      // Clean up event listeners on unmount
      return () => {
        element.removeEventListener('mousemove', handleMouseMove);
        
        if (!trackOutside && elementRef.current) {
          elementRef.current.removeEventListener('mouseleave', handleMouseLeave);
        }
      };
    }
    
    return undefined;
  }, [elementRef, handleMouseMove, handleMouseLeave, trackOutside]);

  return position;
}

