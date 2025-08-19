
import { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle, 
  MessageCircle,
  FileText,
  Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useCrisisManagement, type CrisisActive } from '@/hooks/useCrisisManagement';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface CrisisPanelProps {
  className?: string;
}

export const CrisisPanel = ({ className }: CrisisPanelProps) => {
  const { activeCrises, loading, resolveCrisis, logCrisisAction } = useCrisisManagement();
  const [actionNote, setActionNote] = useState('');
  const [selectedCrisis, setSelectedCrisis] = useState<CrisisActive | null>(null);

  const handleResolve = async (crisisId: string) => {
    const success = await resolveCrisis(crisisId);
    if (success) {
      setSelectedCrisis(null);
    }
  };

  const handleLogAction = async (crisisId: string, action: string) => {
    if (!actionNote.trim()) return;
    
    await logCrisisAction(crisisId, action, { nota: actionNote });
    setActionNote('');
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
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeCrises.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Sistema Normal
          </CardTitle>
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
      <CardHeader className="bg-red-50">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
            <span className="text-red-700">🚨 CRISES ATIVAS</span>
            <Badge variant="destructive">{activeCrises.length}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="space-y-0">
          {activeCrises.map((crisis, index) => (
            <div key={crisis.id}>
              <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive" className="text-xs">
                        CRISE #{index + 1}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {crisis.tickets?.codigo_ticket}
                      </Badge>
                    </div>
                    
                    <h4 className="font-medium text-sm mb-1">
                      {crisis.tickets?.titulo || crisis.tickets?.descricao_problema?.substring(0, 60) + '...'}
                    </h4>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{crisis.tickets?.unidades?.grupo}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNowInSaoPaulo(crisis.criada_em)} atrás</span>
                      </div>
                    </div>
                    
                    <div className="text-xs bg-red-100 text-red-700 p-2 rounded mb-2">
                      <strong>Motivo:</strong> {crisis.motivo}
                    </div>

                    {crisis.impacto_regional?.length > 0 && (
                      <div className="text-xs">
                        <strong>Impacto:</strong> {crisis.impacto_regional.length} unidade(s) afetadas
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
                        onClick={() => setSelectedCrisis(crisis)}
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Ações
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          Gestão de Crise - {crisis.tickets?.codigo_ticket}
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="bg-red-50 p-3 rounded">
                          <h4 className="font-medium text-red-700 mb-2">Detalhes da Crise</h4>
                          <p className="text-sm">{crisis.motivo}</p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Histórico de Ações</h4>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {crisis.log_acoes?.map((action: any, i: number) => (
                              <div key={i} className="text-xs bg-gray-50 p-2 rounded">
                                <div className="flex justify-between">
                                  <span className="font-medium">{action.acao}</span>
                                  <span className="text-muted-foreground">
                                    {new Date(action.em).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                                {action.nota && (
                                  <p className="mt-1 text-muted-foreground">{action.nota}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Registrar Ação</h4>
                          <Textarea
                            placeholder="Descreva a ação tomada..."
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            className="mb-2"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLogAction(crisis.id, 'Ação de Contenção')}
                              disabled={!actionNote.trim()}
                            >
                              <MessageCircle className="h-3 w-3 mr-1" />
                              Log Ação
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLogAction(crisis.id, 'Comunicado Emitido')}
                              disabled={!actionNote.trim()}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Comunicado
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLogAction(crisis.id, 'Reunião Emergencial')}
                              disabled={!actionNote.trim()}
                            >
                              <Phone className="h-3 w-3 mr-1" />
                              Reunião
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleResolve(crisis.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolver Crise
                  </Button>
                </div>
              </div>
              
              {index < activeCrises.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
