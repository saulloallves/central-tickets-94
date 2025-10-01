import { AtendimentosBoard } from '@/components/atendimentos/AtendimentosBoard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Atendimentos() {
  const isMobile = useIsMobile();
  const { isConnected } = useAtendimentos();
  const navigate = useNavigate();

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
        <Button 
          variant="outline" 
          size={isMobile ? "sm" : "default"}
          onClick={() => navigate('/admin/configuracoes?tab=atendentes')}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </div>

      <AtendimentosBoard />
    </div>
  );
}