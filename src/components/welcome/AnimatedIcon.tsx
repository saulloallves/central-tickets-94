import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AnimatedIconProps {
  icon: LucideIcon;
  delay?: number;
  className?: string;
  size?: number;
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  icon: Icon,
  delay = 0,
  className = '',
  size = 16,
}) => {
  return (
    <span
      className={`icon-animate ${className}`}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      <Icon size={size} />
    </span>
  );
};
