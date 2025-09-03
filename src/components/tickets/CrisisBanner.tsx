import { useState, useEffect } from 'react';
import { AlertTriangle, X, Users, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { CrisisModal } from './CrisisModal';

interface Crisis {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
}

export function CrisisBanner() {
  const { user } = useAuth();
  const [activeCrises, setActiveCrises] = useState<Crisis[]>([]);
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dismissedCrises, setDismissedCrises] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // For now, we'll keep this empty until the database schema is fixed
    // The crisis system will be enabled once we have the proper equipe_id column
    const fetchActiveCrises = async () => {
      try {
        // TODO: Implement crisis fetching once equipe_id is added to crises table
        setActiveCrises([]);
      } catch (error) {
        console.error('Erro ao buscar crises:', error);
      }
    };

    fetchActiveCrises();
  }, [user]);

  // Tocar som de alerta quando nova crise aparece
  useEffect(() => {
    if (activeCrises.length > 0) {
      const newCrises = activeCrises.filter(c => !dismissedCrises.has(c.id));
      if (newCrises.length > 0) {
        // Som de alerta específico para crises
        const audio = new Audio('/sounds/crisis-alert.mp3');
        audio.play().catch(e => console.log('Could not play crisis sound:', e));
      }
    }
  }, [activeCrises, dismissedCrises]);

  const handleDismissCrisis = (crisisId: string) => {
    setDismissedCrises(prev => new Set([...prev, crisisId]));
  };

  const handleOpenCrisis = (crisis: Crisis) => {
    setSelectedCrisis(crisis);
    setIsModalOpen(true);
  };

  const visibleCrises = activeCrises.filter(c => !dismissedCrises.has(c.id));

  if (visibleCrises.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2 mb-4">
        {visibleCrises.map((crisis) => (
          <Alert key={crisis.id} className="border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <span className="font-semibold text-destructive">CRISE ATIVA:</span>
                  <span className="ml-2">{crisis.titulo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Crise Ativa
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(crisis.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleOpenCrisis(crisis)}
                >
                  Gerenciar Crise
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismissCrisis(crisis.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>

      {selectedCrisis && (
        <CrisisModal
          crisis={selectedCrisis}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCrisis(null);
          }}
        />
      )}
    </>
  );
}
