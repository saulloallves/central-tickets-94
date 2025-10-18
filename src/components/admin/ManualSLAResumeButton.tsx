import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { useResumeSLA, useReiniciarEPausarSLAs } from "@/hooks/useProcessPendingNotifications";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ManualSLAResumeButton = () => {
  const { mutate: resumeSLA, isPending: isResuming } = useResumeSLA();
  const { mutate: reiniciarEPausar, isPending: isRestarting } = useReiniciarEPausarSLAs();

  return (
    <div className="flex gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => resumeSLA()}
              disabled={isResuming}
              variant="outline"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              {isResuming ? "Despausando..." : "Despausar SLA"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              Remove apenas a pausa por "Fora do horário".
              <br />
              Tickets aguardando resposta continuarão pausados.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => reiniciarEPausar()}
              disabled={isRestarting}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isRestarting ? "Processando..." : "Reiniciar e Pausar SLAs"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              Reinicia o SLA de todos os tickets em aberto não pausados
              <br />
              e pausa por "Fora do horário comercial".
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
