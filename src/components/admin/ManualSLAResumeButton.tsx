import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useResumeSLA } from "@/hooks/useProcessPendingNotifications";

export const ManualSLAResumeButton = () => {
  const { mutate: resumeSLA, isPending } = useResumeSLA();

  return (
    <Button
      onClick={() => resumeSLA()}
      disabled={isPending}
      variant="outline"
      size="sm"
    >
      <Play className="h-4 w-4 mr-2" />
      {isPending ? "Despausando..." : "Despausar SLA Manualmente"}
    </Button>
  );
};
