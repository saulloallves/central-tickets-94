import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, Calendar, UserCheck } from "lucide-react";
import { InternalAccessApproval } from "@/components/equipes/InternalAccessApproval";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface Equipe {
  id: string;
  nome: string;
  descricao: string;
  introducao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function Equipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchEquipes = async () => {
    try {
      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .order('nome');

      if (error) throw error;
      setEquipes(data || []);
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
  }, []);

  const filteredEquipes = equipes.filter(equipe =>
    equipe.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipe.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="view_all_tickets">
        <div className="w-full space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-96"></div>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex space-x-4 animate-pulse">
                    <div className="h-4 bg-muted rounded flex-1"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="view_all_tickets">
      <div className="w-full space-y-6 pt-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Equipes</h2>
          <p className="text-muted-foreground">
            Visualize todas as equipes disponíveis no sistema.
          </p>
        </div>

        <Tabs defaultValue="equipes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="equipes" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipes
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Solicitações de Acesso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipes" className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="text-sm text-muted-foreground mb-4">
              {filteredEquipes.length} equipes encontradas
            </div>

            {filteredEquipes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <div className="text-muted-foreground">
                    {searchTerm ? 'Nenhuma equipe encontrada com os filtros aplicados.' : 'Nenhuma equipe cadastrada.'}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEquipes.map((equipe) => (
                  <Dialog key={equipe.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border bg-white dark:bg-card relative overflow-hidden">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="p-1 bg-green-50 dark:bg-green-900/20 rounded-md">
                              <Users className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div>
                              <CardTitle className="text-sm font-semibold leading-tight">
                                {equipe.nome}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {equipe.descricao}
                              </p>
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              <div>#{equipe.id.substring(0, 8)}</div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0 pb-3 px-4">
                          <Badge 
                            className={`${
                              equipe.ativo
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            } border-0 font-medium uppercase text-xs tracking-wide py-1 px-2`}
                          >
                            {equipe.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                          <Users className="w-5 h-5" />
                          {equipe.nome}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Informações Básicas</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">ID:</span>
                                  <span>{equipe.id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Nome:</span>
                                  <span>{equipe.nome}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Status:</span>
                                  <Badge variant={equipe.ativo ? "default" : "secondary"}>
                                    {equipe.ativo ? "Ativa" : "Inativa"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Descrição</h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Descrição:</span>
                                  <p className="mt-1">{equipe.descricao}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Introdução:</span>
                                  <p className="mt-1 text-xs">{equipe.introducao}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>Criado em: {new Date(equipe.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
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