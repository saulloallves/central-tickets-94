import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, AlertTriangle, CheckCircle, Edit2 } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface GrupoInfo {
  id: string;
  codigo_grupo: string;
  grupo: string;
  id_grupo_branco: string | null;
  ativo: boolean;
  updated_at: string;
}

interface AlertInfo {
  id: string;
  title: string;
  message: string;
  created_at: string;
  processed: boolean;
}

export const GruposDiagnosticoPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGroupId, setNewGroupId] = useState('');

  // Buscar grupos cadastrados
  const { data: grupos, isLoading: loadingGrupos } = useQuery({
    queryKey: ['grupos-diagnostico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendente_unidades')
        .select('id, codigo_grupo, grupo, id_grupo_branco, ativo, updated_at')
        .order('codigo_grupo');
      
      if (error) throw error;
      return data as GrupoInfo[];
    }
  });

  // Buscar alertas de grupos não encontrados
  const { data: alertas, isLoading: loadingAlertas } = useQuery({
    queryKey: ['grupos-alertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_queue')
        .select('id, title, message, created_at, processed')
        .eq('type', 'alert')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as AlertInfo[];
    }
  });

  // Mutation para atualizar ID do grupo
  const updateGroupIdMutation = useMutation({
    mutationFn: async ({ id, newId }: { id: string; newId: string }) => {
      const { error } = await supabase
        .from('atendente_unidades')
        .update({ 
          id_grupo_branco: newId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "ID atualizado",
        description: "ID do grupo atualizado com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ['grupos-diagnostico'] });
      setEditingId(null);
      setNewGroupId('');
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o ID do grupo",
        variant: "destructive"
      });
      console.error(error);
    }
  });

  // Mutation para marcar alerta como processado
  const markProcessedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications_queue')
        .update({ 
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-alertas'] });
    }
  });

  if (loadingGrupos || loadingAlertas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico de Grupos WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie IDs de grupos e monitore tentativas de acesso
          </p>
        </div>
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['grupos-diagnostico'] });
            queryClient.invalidateQueries({ queryKey: ['grupos-alertas'] });
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Alertas de grupos não encontrados */}
      {alertas && alertas.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
            Alertas Recentes ({alertas.filter(a => !a.processed).length} não processados)
          </h2>
          <div className="space-y-3">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`p-4 border rounded-lg ${
                  alerta.processed ? 'bg-muted opacity-50' : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{alerta.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{alerta.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alerta.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {!alerta.processed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markProcessedMutation.mutate(alerta.id)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marcar como resolvido
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista de grupos cadastrados */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          Grupos Cadastrados ({grupos?.length || 0})
        </h2>
        <div className="space-y-2">
          {grupos?.map((grupo) => (
            <div
              key={grupo.id}
              className={`p-4 border rounded-lg ${
                !grupo.ativo ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{grupo.codigo_grupo}</h3>
                    {!grupo.ativo && (
                      <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{grupo.grupo}</p>
                  
                  {editingId === grupo.id ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={newGroupId}
                        onChange={(e) => setNewGroupId(e.target.value)}
                        placeholder="Novo ID do grupo (ex: 120363163110018264-group)"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => updateGroupIdMutation.mutate({ 
                          id: grupo.id, 
                          newId: newGroupId 
                        })}
                        disabled={!newGroupId}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setNewGroupId('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {grupo.id_grupo_branco || 'Não configurado'}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(grupo.id);
                          setNewGroupId(grupo.id_grupo_branco || '');
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Última atualização: {new Date(grupo.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Documentação */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <h2 className="text-xl font-semibold mb-4">📚 Como atualizar ID de grupo</h2>
        <ol className="space-y-2 text-sm">
          <li className="flex gap-2">
            <span className="font-semibold">1.</span>
            <span>Identifique o grupo com problema nos alertas acima</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">2.</span>
            <span>Copie o novo ID do grupo WhatsApp (geralmente termina com -group)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">3.</span>
            <span>Clique em "Editar" no grupo correspondente abaixo</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">4.</span>
            <span>Cole o novo ID e clique em "Salvar"</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">5.</span>
            <span>Teste enviando uma mensagem no grupo do WhatsApp</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">6.</span>
            <span>Marque o alerta como resolvido se tudo funcionar</span>
          </li>
        </ol>
      </Card>
    </div>
  );
};
