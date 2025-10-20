import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Play, Pause, Clock, MessageSquare, ChevronDown } from 'lucide-react';
import { isAnyPauseActive, getPauseReason, getPauseIcon } from '@/lib/sla-flags-documentation';

interface SLADebugPanelProps {
  ticketId: string;
  codigoTicket: string;
  slaMinutosRestantes: number | null;
  slaMinutosTotais: number | null;
  tempoPausadoTotal: any; // INTERVAL do banco
  slaPausado: boolean;
  slaPausadoMensagem: boolean;
  slaPausadoHorario?: boolean;
  dataAbertura: string;
}

export const SLADebugPanel = ({
  ticketId,
  codigoTicket,
  slaMinutosRestantes,
  slaMinutosTotais,
  tempoPausadoTotal,
  slaPausado,
  slaPausadoMensagem,
  slaPausadoHorario = false,
  dataAbertura
}: SLADebugPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const flags = { sla_pausado: slaPausado, sla_pausado_mensagem: slaPausadoMensagem, sla_pausado_horario: slaPausadoHorario };
  const isPaused = isAnyPauseActive(flags);
  const pauseReason = getPauseReason(flags);
  const pauseIcon = getPauseIcon(flags);

  // Calcular tempo decorrido
  const tempoDecorridoMinutos = Math.floor((Date.now() - new Date(dataAbertura).getTime()) / 60000);

  // Converter INTERVAL para minutos (aproximado)
  const getTempoPausadoMinutos = () => {
    if (!tempoPausadoTotal) return 0;
    
    // Se for string (INTERVAL do postgres), fazer parsing
    if (typeof tempoPausadoTotal === 'string') {
      const match = tempoPausadoTotal.match(/(\d+):(\d+):(\d+)/);
      if (match) {
        const [, hours, minutes] = match;
        return parseInt(hours) * 60 + parseInt(minutes);
      }
    }
    return 0;
  };

  const tempoPausadoMinutos = getTempoPausadoMinutos();

  const togglePause = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ sla_pausado: !slaPausado })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: slaPausado ? '▶️ SLA Retomado' : '⏸️ SLA Pausado',
        description: `Ticket ${codigoTicket} teve o SLA ${slaPausado ? 'retomado' : 'pausado'} manualmente`,
      });
    } catch (error) {
      console.error('Erro ao alternar pausa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alternar a pausa do SLA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const forceResync = async () => {
    setLoading(true);
    try {
      // Buscar dados atualizados da view
      const { data, error } = await supabase
        .from('tickets_with_realtime_sla')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) throw error;

      toast({
        title: '🔄 Sincronizado',
        description: `SLA recalculado: ${data.sla_minutos_restantes_calculado} minutos restantes`,
      });

      // Forçar refresh da página (simples mas efetivo)
      window.location.reload();
    } catch (error) {
      console.error('Erro ao resincronizar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível resincronizar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed bg-card/50 backdrop-blur border-amber-500/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    🧪 Debug SLA - {codigoTicket}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Fase 3
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1">
                  Painel de debug e testes (visível apenas para admins)
                </CardDescription>
              </div>
              <ChevronDown 
                className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
        {/* Status atual */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={isPaused ? "secondary" : "default"} className="ml-2">
              {isPaused ? 'Pausado' : 'Ativo'}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Razão:</span>
            <span className="ml-2 font-medium">{pauseReason || 'N/A'}</span>
          </div>
        </div>

        {/* Flags de pausa */}
        <div className="space-y-1 text-xs">
          <div className="font-medium text-muted-foreground">Flags de Pausa:</div>
          <div className="grid grid-cols-3 gap-1">
            <Badge variant={slaPausado ? "destructive" : "outline"}>
              <Pause className="w-3 h-3 mr-1" />
              Manual: {slaPausado ? 'SIM' : 'NÃO'}
            </Badge>
            <Badge variant={slaPausadoMensagem ? "destructive" : "outline"}>
              <MessageSquare className="w-3 h-3 mr-1" />
              Mensagem: {slaPausadoMensagem ? 'SIM' : 'NÃO'}
            </Badge>
            <Badge variant={slaPausadoHorario ? "destructive" : "outline"}>
              <Clock className="w-3 h-3 mr-1" />
              Horário: {slaPausadoHorario ? 'SIM' : 'NÃO'}
            </Badge>
          </div>
        </div>

        {/* Métricas de tempo */}
        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
          <div>
            <div className="text-muted-foreground">SLA Total:</div>
            <div className="font-mono font-bold">{slaMinutosTotais || 0} min</div>
          </div>
          <div>
            <div className="text-muted-foreground">SLA Restante:</div>
            <div className="font-mono font-bold text-primary">{slaMinutosRestantes || 0} min</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tempo Decorrido:</div>
            <div className="font-mono">{tempoDecorridoMinutos} min</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tempo Pausado:</div>
            <div className="font-mono text-amber-600">{tempoPausadoMinutos} min</div>
          </div>
        </div>

        {/* Validação da fórmula */}
        <div className="border-t pt-3 text-xs space-y-1">
          <div className="font-medium text-muted-foreground">Validação da Fórmula:</div>
          <div className="font-mono text-xs bg-muted p-2 rounded">
            SLA Restante = {slaMinutosTotais} - {tempoDecorridoMinutos} + {tempoPausadoMinutos}
            <br />
            = <span className="font-bold text-primary">
              {(slaMinutosTotais || 0) - tempoDecorridoMinutos + tempoPausadoMinutos} min
            </span>
            <br />
            <span className="text-muted-foreground text-xs">
              (Banco: {slaMinutosRestantes} min)
            </span>
          </div>
        </div>

        {/* Ações de teste */}
        <div className="flex gap-2 border-t pt-3">
          <Button
            size="sm"
            variant={slaPausado ? "default" : "outline"}
            onClick={togglePause}
            disabled={loading}
            className="flex-1"
          >
            {slaPausado ? (
              <>
                <Play className="w-3 h-3 mr-1" />
                Retomar SLA
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Pausar SLA
              </>
            )}
          </Button>
        </div>

            {/* Ações de ressincronização */}
            <div className="flex gap-2 border-t pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={forceResync}
                disabled={loading}
                className="flex-1"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Ressincronizar
              </Button>
            </div>

            {/* Legenda */}
            <div className="text-xs text-muted-foreground border-t pt-2">
              <strong>Fase 3:</strong> Sistema usa trigger automático para acumular tempo pausado.
              Backend calcula SLA, frontend apenas exibe.
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
