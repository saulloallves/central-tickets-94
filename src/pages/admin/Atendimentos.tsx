import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AtendimentosBoard } from '@/components/atendimentos/AtendimentosBoard';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Atendimentos() {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gradient-primary mb-2">
            Atendimentos
          </h1>
          <p className="text-muted-foreground">
            Gerencie atendimentos WhatsApp e Typebot em tempo real
          </p>
        </div>
      </div>

      <AtendimentosBoard />
    </div>
  );
}