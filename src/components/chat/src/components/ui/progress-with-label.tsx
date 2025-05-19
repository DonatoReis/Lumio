import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ProgressWithLabelProps extends React.ComponentPropsWithoutRef<typeof Progress> {
  label?: string;
  showValue?: boolean;
  valueFormat?: (value: number) => string;
}

const ProgressWithLabel = React.forwardRef<
  React.ElementRef<typeof Progress>,
  ProgressWithLabelProps
>(({ className, value, label, showValue = true, valueFormat, ...props }, ref) => {
  const formattedValue = React.useMemo(() => {
    if (valueFormat && typeof value === 'number') {
      return valueFormat(value);
    }
    return `${Math.round(value || 0)}%`;
  }, [value, valueFormat]);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        {label && <div className="text-muted-foreground">{label}</div>}
        {showValue && <div className="text-muted-foreground font-medium">{formattedValue}</div>}
      </div>
      <Progress ref={ref} value={value} {...props} />
    </div>
  );
});

ProgressWithLabel.displayName = "ProgressWithLabel";

export { ProgressWithLabel };
