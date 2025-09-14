import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Phone, Building2, Clock, MessageSquare, Bot, User, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AtendimentoDetailProps {
  atendimentoId: string;
  onClose: () => void;
}

export function AtendimentoDetail({ atendimentoId, onClose }: AtendimentoDetailProps) {
  const [observacao, setObservacao] = useState('');
  
  // Mock data - será substituído por hook real
  const atendimento = {
    id: atendimentoId,
    unidade: "Unidade Centro - SP",
    codigo: "U001",
    telefone: "(11) 99999-9999",
    status: 'em_atendimento',
    tempoEspera: 45,
    contato: "Maria Silva",
    ultimaInteracao: {
      tipo: 'mensagem',
      texto: 'Preciso de ajuda com meu pedido',
      tempo: '2 min'
    },
    mensagens: [
      {
        id: 1,
        tipo: 'cliente',
        conteudo: 'Oi, preciso de ajuda com meu pedido',
        timestamp: '14:30',
        isBot: false
      },
      {
        id: 2,
        tipo: 'bot',
        conteudo: 'Olá! Como posso ajudá-lo hoje?',
        timestamp: '14:31',
        isBot: true
      },
      {
        id: 3,
        tipo: 'cliente',
        conteudo: 'Meu pedido #12345 não chegou ainda',
        timestamp: '14:32',
        isBot: false
      },
      {
        id: 4,
        tipo: 'bot',
        conteudo: 'Vou verificar o status do seu pedido. Um momento...',
        timestamp: '14:33',
        isBot: true
      },
      {
        id: 5,
        tipo: 'sistema',
        conteudo: 'Transferido para atendimento humano',
        timestamp: '14:34',
        isBot: false,
        isSystem: true
      }
    ]
  };

  const handleConcluir = () => {
    // TODO: Implementar com edge function
    console.log('Concluir atendimento:', atendimentoId);
  };

  const handleTransferir = () => {
    // TODO: Implementar com edge function
    console.log('Transferir atendimento:', atendimentoId);
  };

  const handleSalvarObservacao = () => {
    if (!observacao.trim()) return;
    // TODO: Salvar observação no banco
    console.log('Salvar observação:', observacao);
    setObservacao('');
  };

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
              <div className="font-medium">{atendimento.unidade}</div>
              <div className="text-sm text-muted-foreground">Código: {atendimento.codigo}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{atendimento.telefone}</span>
          </div>

          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{atendimento.contato}</span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Em fila há {atendimento.tempoEspera} minutos</span>
          </div>

          <Badge variant="info" className="w-fit">
            🔵 Em Atendimento
          </Badge>
        </div>

        <Separator />

        {/* Histórico de mensagens */}
        <div className="flex-1 flex flex-col px-6">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Histórico de Mensagens
          </h4>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {atendimento.mensagens.map((mensagem) => (
                <div 
                  key={mensagem.id}
                  className={cn(
                    "flex gap-3",
                    mensagem.tipo === 'cliente' ? 'justify-start' : 'justify-end'
                  )}
                >
                  {mensagem.tipo === 'cliente' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[70%] rounded-lg p-3 text-sm",
                    mensagem.isSystem ? 
                      "bg-muted text-muted-foreground text-center italic" :
                    mensagem.tipo === 'cliente' ? 
                      "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100" :
                      "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100"
                  )}>
                    <div>{mensagem.conteudo}</div>
                    <div className={cn(
                      "text-xs mt-1 flex items-center gap-1",
                      mensagem.isSystem ? "justify-center" : 
                      mensagem.tipo === 'cliente' ? "justify-start" : "justify-end"
                    )}>
                      {mensagem.isBot && <Bot className="w-3 h-3" />}
                      <span className="opacity-70">{mensagem.timestamp}</span>
                    </div>
                  </div>

                  {mensagem.tipo !== 'cliente' && !mensagem.isSystem && (
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      {mensagem.isBot ? (
                        <Bot className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Observação interna */}
        <div className="px-6 space-y-3">
          <h4 className="font-medium text-sm">Observação Interna</h4>
          <div className="flex gap-2">
            <Textarea
              placeholder="Adicione uma observação interna (não visível para o cliente)..."
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
            <Button onClick={handleConcluir} className="flex-1">
              ✅ Concluir Atendimento
            </Button>
            <Button variant="outline" onClick={handleTransferir} className="flex-1">
              🔄 Transferir para Autoatendimento
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}