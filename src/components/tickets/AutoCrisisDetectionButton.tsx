import { Bot, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAutoCrisisDetection } from "@/hooks/useAutoCrisisDetection";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const AutoCrisisDetectionButton = () => {
  const { runAutoDetection, loading } = useAutoCrisisDetection();

  const handleDetection = async () => {
    await runAutoDetection();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleDetection}
            disabled={loading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            {loading ? "Analisando..." : "Detectar Crises"}
            <Play className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Usar IA para detectar automaticamente padrões de crises</p>
          <p className="text-xs text-muted-foreground">
            Analisa tickets similares e cria crises quando encontra 5+ tickets do mesmo problema
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};