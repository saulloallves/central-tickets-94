import { useState, useEffect } from 'react';
import { AlertTriangle, X, Users, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { CrisisModal } from './CrisisModal';
import { NotificationSounds } from '@/lib/notification-sounds';

// Realtime usado para atualizações automáticas - sem polling

interface Crisis {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  equipe_id: string;
}

export function CrisisBanner() {
  const { user } = useAuth();
  const { isAdmin, isDiretor } = useRole();
  const [activeCrises, setActiveCrises] = useState<Crisis[]>([]);
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dismissedCrises, setDismissedCrises] = useState<Set<string>>(new Set());
  const [alreadyPlayedSounds, setAlreadyPlayedSounds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    // Determinar se usuário é admin/diretor uma única vez
    const userIsAdmin = isAdmin();
    const userIsDiretor = isDiretor();

    // Buscar crises ativas das equipes do usuário + crises globais
    const fetchActiveCrises = async () => {
      try {
        let query = supabase
          .from('crises')
          .select('id, titulo, status, created_at, equipe_id')
          .eq('is_active', true);

        // Admins e diretoria veem todas as crises ativas
        if (userIsAdmin || userIsDiretor) {
          // Nenhum filtro adicional - todas as crises ativas
        } else {
          // Usuários normais só veem crises das suas equipes ou globais
          const { data: userTeams } = await supabase
            .from('equipe_members')
            .select('equipe_id')
            .eq('user_id', user.id)
            .eq('ativo', true);

          const teamIds = userTeams?.map(t => t.equipe_id) || [];

          if (teamIds.length > 0) {
            query = query.or(`equipe_id.in.(${teamIds.join(',')}),equipe_id.is.null`);
          } else {
            query = query.is('equipe_id', null);
          }
        }

        const { data: crises, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar crises ativas:', error);
          
          // Retry logic para evitar loops infinitos
          if (retryCount < maxRetries && isMounted) {
            retryCount++;
            console.log(`Tentativa ${retryCount} de ${maxRetries}...`);
            setTimeout(() => {
              if (isMounted) {
                fetchActiveCrises();
              }
            }, 2000 * retryCount); // Backoff progressivo
          }
          return;
        }

        if (isMounted) {
          setActiveCrises(crises || []);
          retryCount = 0; // Reset retry count on success
        }
      } catch (error) {
        console.error('Erro geral ao buscar crises:', error);
        if (retryCount < maxRetries && isMounted) {
          retryCount++;
          setTimeout(() => {
            if (isMounted) {
              fetchActiveCrises();
            }
          }, 2000 * retryCount);
        }
      }
    };

    // Busca inicial
    fetchActiveCrises();

    // Subscription para mudanças em tempo real
    const crisisSubscription = supabase
      .channel('crisis-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crises'
        },
        (payload) => {
          console.log('🚨 Mudança em crise detectada:', payload);
          // Re-fetch quando houver mudança
          if (isMounted) {
            fetchActiveCrises();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(crisisSubscription);
    };
  }, [user]);

  // Tocar som de alerta quando nova crise aparece (apenas uma vez por crise)
  useEffect(() => {
    if (activeCrises.length > 0) {
      // Filtrar crises que ainda não tiveram som tocado
      const newCrises = activeCrises.filter(c => !alreadyPlayedSounds.has(c.id));
      
      if (newCrises.length > 0) {
        console.log('🚨 Tocando som para novas crises:', newCrises.map(c => c.titulo));
        
        // Som de alerta crítico usando sistema padronizado
        NotificationSounds.playCriticalAlert();
        
        // Marcar essas crises como já tendo som tocado
        setAlreadyPlayedSounds(prev => {
          const newSet = new Set(prev);
          newCrises.forEach(crisis => newSet.add(crisis.id));
          return newSet;
        });
      }
    }
  }, [activeCrises, alreadyPlayedSounds]);

  // Limpar sons de crises que foram resolvidas
  useEffect(() => {
    const activeCrisisIds = new Set(activeCrises.map(c => c.id));
    
    setAlreadyPlayedSounds(prev => {
      const newSet = new Set<string>();
      // Manter apenas sons de crises que ainda estão ativas
      prev.forEach(crisisId => {
        if (activeCrisisIds.has(crisisId)) {
          newSet.add(crisisId);
        }
      });
      return newSet;
    });
  }, [activeCrises]);

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
