
import { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle,
  MessageCircle,
  FileText,
  Phone,
  Plus,
  Settings,
  Send,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useNewCrisisManagement, type Crisis } from '@/hooks/useNewCrisisManagement';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface NewCrisisPanelProps {
  className?: string;
}

export const NewCrisisPanel = ({ className }: NewCrisisPanelProps) => {
  const { 
    activeCrises, 
    loading, 
    createCrisis,
    updateCrisisStatus,
    broadcastMessage,
    resolveCrisisAndCloseTickets,
    unlinkTicketFromCrisis
  } = useNewCrisisManagement();
  
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [newCrisisTitle, setNewCrisisTitle] = useState('');
  const [newCrisisDescription, setNewCrisisDescription] = useState('');
  const [showTickets, setShowTickets] = useState(false); // State for collapsible tickets section

  const handleUpdateStatus = async (crisisId: string, status: Crisis['status'], message?: string) => {
    await updateCrisisStatus(crisisId, status, message);
    setSelectedCrisis(null);
  };

  const handleBroadcast = async (crisisId: string) => {
    if (!broadcastText.trim()) return;
    
    await broadcastMessage(crisisId, broadcastText);
    setBroadcastText('');
  };

  const handleCreateCrisis = async () => {
    if (!newCrisisTitle.trim()) return;
    
    await createCrisis(newCrisisTitle, newCrisisDescription || undefined);
    setNewCrisisTitle('');
    setNewCrisisDescription('');
  };

  const handleUnlinkTicket = async (crisisId: string, ticketId: string) => {
    await unlinkTicketFromCrisis(crisisId, ticketId);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'destructive';
      case 'investigando': return 'secondary';
      case 'comunicado': return 'default';
      case 'mitigado': return 'outline';
      case 'resolvido': return 'default';
      case 'reaberto': return 'destructive';
      case 'encerrado': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'Aberta';
      case 'investigando': return 'Investigando';
      case 'comunicado': return 'Comunicada';
      case 'mitigado': return 'Mitigada';
      case 'resolvido': return 'Resolvida';
      case 'reaberto': return 'Reaberta';
      case 'encerrado': return 'Encerrada';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Gestão de Crises
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeCrises.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Sistema Normal
          </CardTitle>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova Crise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Crise</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Título da crise"
                  value={newCrisisTitle}
                  onChange={(e) => setNewCrisisTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={newCrisisDescription}
                  onChange={(e) => setNewCrisisDescription(e.target.value)}
                />
                <Button onClick={handleCreateCrisis} disabled={!newCrisisTitle.trim()}>
                  Criar Crise
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p>Nenhuma crise ativa no momento</p>
            <p className="text-sm">Sistema operando normalmente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-red-200", className)}>
      <CardHeader className="bg-red-50 flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
          <span className="text-red-700">🚨 CRISES ATIVAS</span>
          <Badge variant="destructive">{activeCrises.length}</Badge>
        </CardTitle>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova Crise
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Crise</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Título da crise"
                value={newCrisisTitle}
                onChange={(e) => setNewCrisisTitle(e.target.value)}
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={newCrisisDescription}
                onChange={(e) => setNewCrisisDescription(e.target.value)}
              />
              <Button onClick={handleCreateCrisis} disabled={!newCrisisTitle.trim()}>
                Criar Crise
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="space-y-0">
          {activeCrises.map((crisis, index) => {
            const ticketCount = crisis.crise_ticket_links?.length || 0;
            const lastUpdate = crisis.crise_updates?.[0];
            
            return (
              <div key={crisis.id}>
                <div className="p-4 border-l-4 border-l-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-sm text-destructive leading-tight">
                            {crisis.titulo}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={getStatusColor(crisis.status)} className="text-xs">
                              {getStatusLabel(crisis.status)}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              📋 {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {crisis.descricao && (
                        <p className="text-xs text-muted-foreground mb-2 bg-background/50 p-2 rounded border">
                          {crisis.descricao}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Criada {formatDistanceToNowInSaoPaulo(crisis.created_at)} atrás</span>
                        </div>
                        {lastUpdate && (
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>Última: {formatDistanceToNowInSaoPaulo(lastUpdate.created_at)} atrás</span>
                          </div>
                        )}
                      </div>

                      {crisis.palavras_chave && crisis.palavras_chave.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {crisis.palavras_chave.slice(0, 3).map((palavra, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {palavra}
                            </Badge>
                          ))}
                          {crisis.palavras_chave.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{crisis.palavras_chave.length - 3} mais
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="hover:bg-destructive/10 hover:border-destructive/30 border-destructive/20"
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Gerenciar Crise
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            Gestão de Crise - {crisis.titulo}
                            <Badge variant="destructive" className="ml-2">
                              {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                            </Badge>
                          </DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          {/* Informações da Crise */}
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Informações da Crise
                            </h4>
                            <p className="text-sm mb-3">{crisis.descricao || 'Sem descrição'}</p>
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="font-medium">Status:</span> {getStatusLabel(crisis.status)}
                              </div>
                              <div>
                                <span className="font-medium">Criada:</span> {formatDistanceToNowInSaoPaulo(crisis.created_at)} atrás
                              </div>
                              <div>
                                <span className="font-medium">Tickets:</span> {ticketCount} vinculado{ticketCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          {/* Tickets Vinculados - Seção Recolhível */}
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowTickets(!showTickets)}
                              className="flex items-center gap-2 mb-4"
                            >
                              <FileText className="h-4 w-4" />
                              Tickets Vinculados ({crisis.crise_ticket_links?.length || 0})
                              {showTickets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>

                            {/* Conteúdo Expandível */}
                            {showTickets && (
                              <div className="min-h-[200px]">
                                {crisis.crise_ticket_links && crisis.crise_ticket_links.length > 0 ? (
                                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
                                      {crisis.crise_ticket_links.map((link, index) => (
                                        <div 
                                          key={link.ticket_id} 
                                          className={cn(
                                            "p-3 bg-white border-b last:border-b-0",
                                            index % 2 === 0 ? "bg-gray-50" : "bg-white"
                                          )}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" className="text-xs">
                                                {link.tickets?.unidades?.grupo || 'N/A'}
                                              </Badge>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs hover:bg-blue-100 hover:text-blue-700"
                                                onClick={() => {
                                                  // Abrir modal do ticket
                                                  const ticketEvent = new CustomEvent('openTicketModal', {
                                                    detail: { ticketId: link.ticket_id }
                                                  });
                                                  window.dispatchEvent(ticketEvent);
                                                }}
                                              >
                                                {link.tickets?.codigo_ticket || 'N/A'}
                                              </Button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Badge 
                                                variant={link.tickets?.status === 'concluido' ? 'default' : 'destructive'} 
                                                className="text-xs"
                                              >
                                                {link.tickets?.status || 'N/A'}
                                              </Badge>
                                              <Badge 
                                                variant={link.tickets?.prioridade === 'crise' ? 'destructive' : 'secondary'} 
                                                className="text-xs"
                                              >
                                                {link.tickets?.prioridade || 'N/A'}
                                              </Badge>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 text-xs hover:bg-red-100 hover:text-red-700 border-red-200"
                                                onClick={() => handleUnlinkTicket(crisis.id, link.ticket_id)}
                                              >
                                                Desvincular
                                              </Button>
                                            </div>
                                          </div>
                                          <p className="text-sm font-medium mb-2">
                                            {link.tickets?.descricao_problema || 'Sem descrição'}
                                          </p>
                                         </div>
                                     ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum ticket vinculado a esta crise</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Atualizar Status da Crise */}
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Atualizar Status da Crise
                            </h4>
                            <div className="space-y-3">
                              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <p className="text-xs text-yellow-700">
                                  Status atual: <strong>{getStatusLabel(crisis.status)}</strong>
                                </p>
                              </div>
                              
                              <Select 
                                defaultValue={crisis.status}
                                onValueChange={(value) => {
                                  const validStatuses = ['aberto', 'investigando', 'comunicado', 'mitigado', 'resolvido', 'reaberto'] as const;
                                  if (validStatuses.includes(value as any)) {
                                    handleUpdateStatus(crisis.id, value as typeof validStatuses[number], `Status alterado para ${getStatusLabel(value)}`);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="aberto">🚨 Aberta</SelectItem>
                                  <SelectItem value="investigando">🔍 Investigando</SelectItem>
                                  <SelectItem value="comunicado">📢 Comunicada</SelectItem>
                                  <SelectItem value="mitigado">⚠️ Mitigada</SelectItem>
                                  <SelectItem value="resolvido">✅ Resolvida</SelectItem>
                                  <SelectItem value="reaberto">🔄 Reaberta</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => resolveCrisisAndCloseTickets(crisis.id, 'Crise encerrada - todos os tickets foram resolvidos')}
                                className="w-full"
                              >
                                🏁 Encerrar Crise e Fechar Tickets
                              </Button>
                            </div>
                          </div>

                          {/* Broadcast Message - Melhorado */}
                          <div className="border-t pt-4">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              Enviar Mensagem para Todos os Tickets ({ticketCount})
                            </h4>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-3">
                              <p className="text-xs text-blue-700 mb-1">
                                📨 Esta mensagem será enviada para <strong>todos os {ticketCount} tickets</strong> vinculados a esta crise
                              </p>
                              <p className="text-xs text-blue-600">
                                Grupos afetados: {crisis.crise_ticket_links?.map(link => link.tickets?.unidades?.grupo).filter(Boolean).join(', ') || 'N/A'}
                              </p>
                            </div>
                            <Textarea
                              placeholder="Digite a mensagem que será enviada para TODOS os tickets desta crise e seus respectivos grupos..."
                              value={broadcastText}
                              onChange={(e) => setBroadcastText(e.target.value)}
                              className="mb-3 min-h-[80px]"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleBroadcast(crisis.id)}
                                disabled={!broadcastText.trim()}
                                className="flex-1"
                              >
                                <Send className="h-3 w-3 mr-2" />
                                Enviar para Todos os Tickets ({ticketCount})
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBroadcastText('')}
                                disabled={!broadcastText.trim()}
                              >
                                Limpar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => resolveCrisisAndCloseTickets(crisis.id, 'Crise resolvida e tickets encerrados automaticamente')}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Encerrar Crise
                    </Button>
                  </div>
                </div>
                
                {index < activeCrises.length - 1 && <Separator />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
