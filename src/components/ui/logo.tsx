import React from 'react';
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg";
}

const Logo: React.FC<LogoProps> = ({ 
  className, 
  variant = "full", 
  size = "md" 
}) => {
  // Size classes based on the size prop
  const sizeClasses: Record<string, string> = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };
  
  return (
    <div className={cn("font-bold flex items-center", sizeClasses[size], className)}>
      {/* icon */}
      <div className="text-app-purple mr-2">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24"
          fill="currentColor"
          className={cn(
            "h-auto",
            size === "sm" && "w-6",
            size === "md" && "w-7",
            size === "lg" && "w-8"
          )}
        >
          <path d="M16.5 3C19.538 3 22 5.5 22 9C22 16 14.5 20 12 22C9.5 20 2 16 2 9C2 5.5 4.5 3 7.5 3C9.36 3 11 4 12 5C13 4 14.64 3 16.5 3Z" />
        </svg>
      </div>
      {/* full variant with superscript AI */}
      {variant === "full" && (
        <div className="relative inline-block">
          <span className="text-gradient">Lumio</span>
          <sup className="absolute top-0 right-[-2px] text-xs text-app-white -translate-y-1/2">
            AI
          </sup>
        </div>
      )}
    </div>
  );
};

export default Logo;
