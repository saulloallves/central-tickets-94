import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
        <p className="mt-4 text-muted-foreground font-medium">Carregando...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;