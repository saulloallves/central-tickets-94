import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, UserCheck, Plus } from "lucide-react";
import { InternalAccessApproval } from "@/components/equipes/InternalAccessApproval";
import { EquipeCard } from "@/components/equipes/EquipeCard";
import { CreateEquipeDialog } from "@/components/equipes/CreateEquipeDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

interface Equipe {
  id: string;
  nome: string;
  descricao: string;
  introducao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface EquipeWithMembers extends Equipe {
  member_count: number;
  is_user_leader: boolean;
}

export default function Equipes() {
  const [equipes, setEquipes] = useState<EquipeWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasRole } = useRole();

  const fetchEquipes = async () => {
    try {
      // Buscar equipes básicas
      const { data: equipesData, error: equipesError } = await supabase
        .from('equipes')
        .select('*')
        .order('nome');

      if (equipesError) throw equipesError;

      // Para cada equipe, buscar contagem de membros e verificar se o usuário é líder
      const equipesWithMembers = await Promise.all(
        (equipesData || []).map(async (equipe) => {
          // Contar membros ativos
          const { count: memberCount } = await supabase
            .from('equipe_members')
            .select('*', { count: 'exact', head: true })
            .eq('equipe_id', equipe.id)
            .eq('ativo', true);

          // Verificar se o usuário atual é líder desta equipe
          let isUserLeader = false;
          if (user) {
            const { data: leaderData } = await supabase
              .from('equipe_members')
              .select('role')
              .eq('equipe_id', equipe.id)
              .eq('user_id', user.id)
              .eq('ativo', true)
              .in('role', ['leader', 'supervisor'])
              .maybeSingle();

            isUserLeader = !!leaderData;
          }

          return {
            ...equipe,
            member_count: memberCount || 0,
            is_user_leader: isUserLeader
          };
        })
      );

      setEquipes(equipesWithMembers);
    } catch (error) {
      console.error('Error fetching equipes:', error);
      toast({
        title: "Erro ao carregar equipes",
        description: "Não foi possível carregar a lista de equipes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipes();
  }, [user]);

  const filteredEquipes = equipes.filter(equipe =>
    equipe.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipe.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreateEquipe = hasRole('admin') || hasRole('diretoria');

  if (loading) {
    return (
      <ProtectedRoute requiredPermissions={['view_all_tickets', 'view_team_tickets']} requireAll={false}>
        <div className="w-full space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-96"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermissions={['view_all_tickets', 'view_team_tickets']} requireAll={false}>
      <div className="w-full space-y-4 md:space-y-6 pt-3 md:pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">Equipes</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Gerencie as equipes e seus membros no sistema.
            </p>
          </div>
          
          {canCreateEquipe && (
            <div className="w-full md:w-auto">
              <CreateEquipeDialog onSuccess={fetchEquipes} />
            </div>
          )}
        </div>

        <Tabs defaultValue="equipes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="equipes" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipes ({filteredEquipes.length})
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Solicitações de Acesso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipes" className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredEquipes.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'Nenhuma equipe encontrada' : 'Nenhuma equipe cadastrada'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm 
                    ? 'Tente ajustar os filtros de busca.' 
                    : 'Comece criando sua primeira equipe para organizar os membros.'
                  }
                </p>
                {canCreateEquipe && !searchTerm && (
                  <CreateEquipeDialog onSuccess={fetchEquipes} />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                {filteredEquipes.map((equipe) => (
                  <EquipeCard
                    key={equipe.id}
                    equipe={equipe}
                    memberCount={equipe.member_count}
                    isLeader={equipe.is_user_leader}
                    onRefresh={fetchEquipes}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="solicitacoes" className="space-y-4">
            <InternalAccessApproval />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}