import React, { useEffect, useState, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (location !== displayLocation) {
      setIsTransitioning(true);
      // Wait for new content to be ready before transitioning
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setIsTransitioning(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation]);

  return (
    <div 
      className={cn(
        "transition-opacity duration-200 ease-in-out",
        isTransitioning ? "opacity-0" : "opacity-100",
        className
      )}
      key={displayLocation.pathname}
    >
      <Suspense fallback={
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      }>
        {children}
      </Suspense>
    </div>
  );
};

export default PageTransition;