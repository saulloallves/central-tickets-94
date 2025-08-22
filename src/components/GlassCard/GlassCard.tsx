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
  const getVariantClass = () => {
    switch (variant) {
      case 'pill': return 'glass-pill';
      case 'badge': return 'glass-badge';
      case 'strong': return 'glass-strong';
      default: return 'glass';
    }
  };

  return (
    <div className={cn(
      getVariantClass(),
      hover && 'glass-hover',
      className
    )}>
      {children}
    </div>
  );
};

export default GlassCard;