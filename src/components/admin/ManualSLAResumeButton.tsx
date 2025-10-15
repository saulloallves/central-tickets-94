import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useResumeSLA } from "@/hooks/useProcessPendingNotifications";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ManualSLAResumeButton = () => {
  const { mutate: resumeSLA, isPending } = useResumeSLA();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => resumeSLA()}
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            {isPending ? "Despausando..." : "Despausar SLA (Fora do Horário)"}
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
  );
};
