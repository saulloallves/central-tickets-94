import React, { ReactNode } from 'react';

interface AnimatedFormElementProps {
  children: ReactNode;
  delay?: number;
  direction?: 'left' | 'right' | 'up';
  className?: string;
}

export const AnimatedFormElement: React.FC<AnimatedFormElementProps> = ({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}) => {
  const directionClass = `slide-in-${direction}`;
  
  return (
    <div
      className={`${directionClass} ${className}`}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};
