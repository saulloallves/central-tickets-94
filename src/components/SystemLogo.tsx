import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';

export function SystemLogo() {
  const { logoUrl, isLoading } = useSystemSettings();

  if (isLoading) {
    return (
      <div className="w-12 h-12 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 flex items-center justify-center">
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt="Logo do Sistema" 
          className="w-10 h-10 object-contain rounded drop-shadow-lg"
        />
      ) : (
        <ClipboardList className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={1.5} />
      )}
    </div>
  );
}