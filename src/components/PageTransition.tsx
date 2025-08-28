import React from 'react';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  return (
    <div className={cn("animate__animated animate__fadeIn animate-fast", className)}>
      {children}
    </div>
  );
};

export default PageTransition;