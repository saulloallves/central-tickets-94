import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'pill' | 'badge' | 'strong' | 'liquid';
  hover?: boolean;
  style?: React.CSSProperties;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  hover = false,
  style = {}
}) => {
  const glassStyle = {
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const getVariantClass = () => {
    switch (variant) {
      case 'pill': return 'rounded-full px-6 py-3 bg-white/25 backdrop-blur-md border border-white/50 shadow-lg hover:bg-white/30 transition-all duration-700';
      case 'badge': return 'rounded-2xl px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/40 shadow-md';
      case 'strong': return 'rounded-3xl p-6 bg-white/30 backdrop-blur-xl border-2 border-white/60 shadow-xl';
      case 'liquid': return 'relative overflow-hidden rounded-3xl';
      default: return 'rounded-3xl p-6 bg-white/25 backdrop-blur-md border border-white/50 shadow-lg';
    }
  };

  if (variant === 'liquid') {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl transition-all duration-700',
          hover && 'hover:shadow-2xl hover:scale-[1.02]',
          className
        )}
        style={glassStyle}
      >
        {/* Camada 1: Backdrop blur */}
        <div
          className="absolute inset-0 z-0 rounded-3xl"
          style={{
            backdropFilter: "blur(3px)",
            isolation: "isolate",
          }}
        />
        
        {/* Camada 2: Background semi-transparente */}
        <div
          className="absolute inset-0 z-10"
          style={{ background: "rgba(255, 255, 255, 0.25)" }}
        />
        
        {/* Camada 3: Inset shadows para profundidade */}
        <div
          className="absolute inset-0 z-20 rounded-3xl"
          style={{
            boxShadow:
              "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
          }}
        />

        {/* Conteúdo */}
        <div className="relative z-30">{children}</div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        getVariantClass(),
        hover && 'hover:shadow-xl hover:scale-105',
        'transition-all duration-700',
        className
      )}
      style={variant === 'default' ? glassStyle : style}
    >
      {children}
    </div>
  );
};

export default GlassCard;