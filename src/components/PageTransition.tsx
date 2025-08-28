import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState("fadeIn");

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage("fadeOut");
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage("fadeIn");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation]);

  return (
    <div 
      className={cn(
        "animate__animated animate-fast",
        transitionStage === "fadeIn" ? "animate__fadeIn" : "animate__fadeOut",
        className
      )}
      key={displayLocation.pathname}
    >
      {children}
    </div>
  );
};

export default PageTransition;