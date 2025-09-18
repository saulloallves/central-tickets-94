import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mx-auto"></div>
        <p className="mt-4 text-white/80 font-medium">Carregando...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;