import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProgressProps {
  currentStep: number;
  steps: Array<{ number: number; label: string }>;
}

export const StepProgress: React.FC<StepProgressProps> = ({ currentStep, steps }) => {
  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        
        return (
          <div
            key={step.number}
            className="flex items-start gap-4 transition-all duration-300"
          >
            <div className={cn(
              "flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300",
              isCompleted && "bg-white text-primary",
              isCurrent && "bg-white text-primary ring-2 ring-white ring-offset-2 ring-offset-primary/50",
              !isCompleted && !isCurrent && "bg-white/30 text-white/70"
            )}>
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                step.number
              )}
            </div>
            
            <span className={cn(
              "text-base transition-all duration-300 pt-2.5",
              isCurrent && "text-white font-semibold",
              isCompleted && "text-white/80",
              !isCompleted && !isCurrent && "text-white/60"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
