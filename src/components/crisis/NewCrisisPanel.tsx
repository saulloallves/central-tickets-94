
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
  BarChart3
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
    resolveCrisisAndCloseTickets
  } = useNewCrisisManagement();
  
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [newCrisisTitle, setNewCrisisTitle] = useState('');
  const [newCrisisDescription, setNewCrisisDescription] = useState('');

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'destructive';
      case 'investigando': return 'secondary';
      case 'comunicado': return 'default';
      case 'mitigado': return 'outline';
      case 'reaberto': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'Aberta';
      case 'investigando': return 'Investigando';
      case 'comunicado': return 'Comunicada';
      case 'mitigado': return 'Mitigada';
      case 'reaberto': return 'Reaberta';
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
      <CardHeader className="bg-red-50 flex flex-row items-center justify-between">
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
                <div className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getStatusColor(crisis.status)} className="text-xs">
                          {getStatusLabel(crisis.status)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          📋 {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <h4 className="font-medium text-sm mb-1">
                        {crisis.titulo}
                      </h4>
                      
                      {crisis.descricao && (
                        <p className="text-xs text-muted-foreground mb-2">
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
                        <div className="flex gap-1 mb-2">
                          {crisis.palavras_chave.slice(0, 3).map((palavra, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {palavra}
                            </Badge>
                          ))}
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
                          className="hover:bg-red-50 hover:border-red-200"
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Gerenciar Crise
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            Gestão de Crise - {crisis.titulo}
                          </DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div className="bg-red-50 p-3 rounded">
                            <h4 className="font-medium text-red-700 mb-2">Informações da Crise</h4>
                            <p className="text-sm mb-2">{crisis.descricao || 'Sem descrição'}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Status: {getStatusLabel(crisis.status)}</span>
                              <span>•</span>
                              <span>{ticketCount} ticket{ticketCount !== 1 ? 's' : ''} vinculado{ticketCount !== 1 ? 's' : ''}</span>
                            </div>
                          </div>

                          {/* Tickets Vinculados */}
                          {crisis.crise_ticket_links && crisis.crise_ticket_links.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Tickets Vinculados</h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {crisis.crise_ticket_links.map((link) => (
                                  <div key={link.ticket_id} className="text-xs bg-gray-50 p-2 rounded flex items-center justify-between">
                                    <span>{link.tickets?.codigo_ticket} - {link.tickets?.unidades?.grupo}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {link.tickets?.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Histórico de Atualizações */}
                          {crisis.crise_updates && crisis.crise_updates.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Histórico de Atualizações</h4>
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {crisis.crise_updates.slice(0, 5).map((update) => (
                                  <div key={update.id} className="text-xs bg-gray-50 p-2 rounded">
                                    <div className="flex justify-between mb-1">
                                      <Badge variant="outline" className="text-xs">
                                        {update.tipo}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        {new Date(update.created_at).toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground">{update.mensagem}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Atualizar Status */}
                          <div>
                            <h4 className="font-medium mb-2">Atualizar Status</h4>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateStatus(crisis.id, 'investigando', 'Status atualizado para investigando')}
                              >
                                Investigando
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateStatus(crisis.id, 'comunicado', 'Crise comunicada aos stakeholders')}
                              >
                                Comunicado
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateStatus(crisis.id, 'mitigado', 'Crise mitigada, monitorando')}
                              >
                                Mitigado
                              </Button>
                            </div>
                          </div>

                          {/* Broadcast Message */}
                          <div>
                            <h4 className="font-medium mb-2">Enviar Mensagem para Todos os Tickets</h4>
                            <Textarea
                              placeholder="Digite a mensagem que será enviada para todos os tickets desta crise..."
                              value={broadcastText}
                              onChange={(e) => setBroadcastText(e.target.value)}
                              className="mb-2"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBroadcast(crisis.id)}
                              disabled={!broadcastText.trim()}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Enviar para Todos
                            </Button>
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
