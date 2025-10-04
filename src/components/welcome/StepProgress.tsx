import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProgressProps {
  currentStep: number;
  steps: Array<{ number: number; label: string }>;
}

export const StepProgress: React.FC<StepProgressProps> = ({ currentStep, steps }) => {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        
        return (
          <div
            key={step.number}
            className={cn(
              "flex items-center gap-4 transition-all duration-500",
              isCurrent && "scale-105"
            )}
          >
            <div className={cn(
              "relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-500",
              isCompleted && "bg-primary text-primary-foreground scale-110",
              isCurrent && "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
              !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
            )}>
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 animate-scale-in" />
              ) : isCurrent ? (
                <Circle className="h-5 w-5 fill-current animate-pulse" />
              ) : (
                <span className="text-sm font-bold">{step.number}</span>
              )}
              
              {isCurrent && (
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              )}
            </div>
            
            <span className={cn(
              "text-sm font-medium transition-all duration-300",
              isCurrent && "text-foreground font-semibold",
              isCompleted && "text-muted-foreground line-through",
              !isCompleted && !isCurrent && "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
