import { useState, useEffect } from 'react';
import { AlertTriangle, X, Users, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CrisisModal } from './CrisisModal';
import { NotificationSounds } from '@/lib/notification-sounds';

interface Crisis {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  equipe_id: string;
}

export function CrisisBanner() {
  const { user } = useAuth();
  const [activeCrises, setActiveCrises] = useState<Crisis[]>([]);
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dismissedCrises, setDismissedCrises] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Buscar crises ativas das equipes do usuário + crises globais
    const fetchActiveCrises = async () => {
      const { data: userTeams } = await supabase
        .from('equipe_members')
        .select('equipe_id')
        .eq('user_id', user.id)
        .eq('ativo', true);

      const teamIds = userTeams?.map(t => t.equipe_id) || [];

      // Buscar crises das equipes do usuário OU crises globais (sem equipe específica)
      let query = supabase
        .from('crises')
        .select('id, titulo, status, created_at, equipe_id')
        .eq('is_active', true);

      if (teamIds.length > 0) {
        query = query.or(`equipe_id.in.(${teamIds.join(',')}),equipe_id.is.null`);
      } else {
        query = query.is('equipe_id', null);
      }

      const { data: crises, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar crises ativas:', error);
        return;
      }

      console.log('🚨 Crises encontradas:', crises);
      setActiveCrises(crises || []);
    };

    fetchActiveCrises();

    // Subscription para updates em tempo real de crises
    const channel = supabase
      .channel('crisis-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crises'
        },
        (payload) => {
          console.log('Crisis realtime update:', payload);
          // Atualizar imediatamente quando houver mudanças
          fetchActiveCrises();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Tocar som de alerta quando nova crise aparece
  useEffect(() => {
    if (activeCrises.length > 0) {
      const newCrises = activeCrises.filter(c => !dismissedCrises.has(c.id));
      if (newCrises.length > 0) {
        // Som de alerta crítico usando sistema padronizado
        NotificationSounds.playCriticalAlert();
      }
    }
  }, [activeCrises, dismissedCrises]);

  const handleDismissCrisis = (crisisId: string) => {
    // Não permitir dismiss - crise deve ficar fixa até ser resolvida
    console.log('Dismiss não permitido para crise ativa:', crisisId);
  };

  const handleOpenCrisis = (crisis: Crisis) => {
    setSelectedCrisis(crisis);
    setIsModalOpen(true);
  };

  const visibleCrises = activeCrises; // Mostrar todas as crises ativas sempre

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
