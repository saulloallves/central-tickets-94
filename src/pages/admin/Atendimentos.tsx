import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AtendimentosBoard } from '@/components/atendimentos/AtendimentosBoard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

export default function Atendimentos() {
  const isMobile = useIsMobile();
  const { isConnected } = useAtendimentos();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-gradient-primary">
              Atendimentos
            </h1>
            <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-1">
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Tempo Real
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Desconectado
                </>
              )}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Gerencie atendimentos WhatsApp e Typebot em tempo real
          </p>
        </div>
      </div>

      <AtendimentosBoard />
    </div>
  );
}