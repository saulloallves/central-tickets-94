import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'pill' | 'badge' | 'strong';
  hover?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  hover = false 
}) => {
  const glassClasses = {
    default: 'glass',
    pill: 'glass-pill',
    badge: 'glass-badge',
    strong: 'glass-strong'
  };

  return (
    <div className={cn(
      glassClasses[variant],
      hover && 'glass-hover',
      className
    )}>
      {children}
    </div>
  );
};

export default GlassCard;