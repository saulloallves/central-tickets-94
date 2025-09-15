import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Phone, Building2, Clock, MessageSquare, User, Send, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AtendimentoDetailProps {
  atendimentoId: string;
  onClose: () => void;
}

interface Atendimento {
  id: string;
  unidade_id: string;
  franqueado_nome: string;
  telefone: string;
  descricao: string;
  categoria?: string;
  prioridade: string;
  status: string;
  tipo_atendimento: string;
  atendente_id?: string;
  atendente_nome?: string;
  resolucao?: string;
  criado_em: string;
  atualizado_em?: string;
}

const STATUS_CONFIG = {
  em_fila: { variant: 'warning' as const, emoji: '🟡', label: 'Em Fila' },
  em_atendimento: { variant: 'info' as const, emoji: '🔵', label: 'Em Atendimento' },
  finalizado: { variant: 'success' as const, emoji: '🟢', label: 'Finalizado' },
};

export function AtendimentoDetail({ atendimentoId, onClose }: AtendimentoDetailProps) {
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAtendimento = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('chamados')
          .select('*')
          .eq('id', atendimentoId)
          .single();

        if (error) {
          console.error('Erro ao buscar atendimento:', error);
          toast({
            title: "Erro ao carregar atendimento",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        setAtendimento(data);
      } catch (error) {
        console.error('Erro ao buscar atendimento:', error);
        toast({
          title: "Erro ao carregar atendimento",
          description: "Erro inesperado ao carregar os dados",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAtendimento();
  }, [atendimentoId]);

  const formatTempo = (data: string) => {
    try {
      const dataObj = new Date(data);
      return formatDistanceToNow(dataObj, { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'há alguns instantes';
    }
  };

  const handleConcluir = async () => {
    try {
      const { error } = await supabase
        .from('chamados')
        .update({ 
          status: 'finalizado',
          atualizado_em: new Date().toISOString(),
          resolucao: observacao || 'Atendimento finalizado'
        })
        .eq('id', atendimentoId);

      if (error) throw error;

      toast({
        title: "Atendimento finalizado",
        description: "O atendimento foi finalizado com sucesso.",
      });
      
      onClose();
    } catch (error) {
      console.error('Erro ao finalizar atendimento:', error);
      toast({
        title: "Erro ao finalizar atendimento",
        description: "Não foi possível finalizar o atendimento.",
        variant: "destructive",
      });
    }
  };

  const handleIniciarAtendimento = async () => {
    try {
      const { error } = await supabase
        .from('chamados')
        .update({ 
          status: 'em_atendimento',
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', atendimentoId);

      if (error) throw error;

      toast({
        title: "Atendimento iniciado",
        description: "O atendimento foi iniciado com sucesso.",
      });
      
      // Atualizar estado local
      if (atendimento) {
        setAtendimento({ ...atendimento, status: 'em_atendimento' });
      }
    } catch (error) {
      console.error('Erro ao iniciar atendimento:', error);
      toast({
        title: "Erro ao iniciar atendimento",
        description: "Não foi possível iniciar o atendimento.",
        variant: "destructive",
      });
    }
  };

  const handleSalvarObservacao = async () => {
    if (!observacao.trim()) return;
    
    try {
      const { error } = await supabase
        .from('chamados')
        .update({ 
          resolucao: observacao,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', atendimentoId);

      if (error) throw error;

      toast({
        title: "Observação salva",
        description: "A observação foi salva com sucesso.",
      });
      
      setObservacao('');
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast({
        title: "Erro ao salvar observação",
        description: "Não foi possível salvar a observação.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando detalhes do atendimento...</p>
        </div>
      </Card>
    );
  }

  if (!atendimento) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Atendimento não encontrado</p>
        </div>
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[atendimento.status] || STATUS_CONFIG.em_fila;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Detalhes do Atendimento</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 p-0">
        {/* Dados da unidade */}
        <div className="px-6 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{atendimento.unidade_id}</div>
              <div className="text-sm text-muted-foreground">Franqueado: {atendimento.franqueado_nome}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{atendimento.telefone}</span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Criado {formatTempo(atendimento.criado_em)}</span>
          </div>

          {atendimento.atendente_nome && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Atendido por: {atendimento.atendente_nome}</span>
            </div>
          )}

          <Badge variant={statusConfig.variant} className="w-fit">
            {statusConfig.emoji} {statusConfig.label}
          </Badge>
        </div>

        <Separator />

        {/* Descrição do atendimento */}
        <div className="px-6">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Descrição do Atendimento
          </h4>
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
            {atendimento.descricao}
          </div>
          
          {atendimento.categoria && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">Categoria: </span>
              <Badge variant="secondary" className="text-xs">
                {atendimento.categoria}
              </Badge>
            </div>
          )}
          
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">Tipo: </span>
            <Badge variant="outline" className="text-xs">
              {atendimento.tipo_atendimento}
            </Badge>
          </div>
        </div>

        {atendimento.resolucao && (
          <>
            <Separator />
            <div className="px-6">
              <h4 className="font-medium mb-3">Resolução</h4>
              <div className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                {atendimento.resolucao}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Observação interna */}
        <div className="px-6 space-y-3">
          <h4 className="font-medium text-sm">Observação Interna</h4>
          <div className="flex gap-2">
            <Textarea
              placeholder="Adicione uma observação interna..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="flex-1 min-h-[80px] resize-none"
            />
            <Button
              onClick={handleSalvarObservacao}
              disabled={!observacao.trim()}
              className="px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Ações */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            {atendimento.status === 'em_fila' && (
              <Button onClick={handleIniciarAtendimento} className="flex-1">
                🔵 Iniciar Atendimento
              </Button>
            )}
            {atendimento.status === 'em_atendimento' && (
              <Button onClick={handleConcluir} className="flex-1">
                ✅ Finalizar Atendimento
              </Button>
            )}
            {atendimento.status === 'finalizado' && (
              <div className="flex-1 text-center text-sm text-muted-foreground py-2">
                Atendimento finalizado
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}