import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useBulkTicketAnalysis } from '@/hooks/useBulkTicketAnalysis';
import { 
  Brain, 
  Loader2, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Eye,
  Zap
} from 'lucide-react';

interface BulkAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipeId: string;
  equipeNome: string;
}

export const BulkAnalysisDialog = ({ 
  open, 
  onOpenChange, 
  equipeId, 
  equipeNome 
}: BulkAnalysisDialogProps) => {
  const [autoCreateCrises, setAutoCreateCrises] = useState(false);
  const [minTicketsPerGroup, setMinTicketsPerGroup] = useState(3);
  const { analyzeTeamTickets, isLoading, results, clearResults } = useBulkTicketAnalysis();

  const handleAnalyze = async () => {
    await analyzeTeamTickets(equipeId, autoCreateCrises, minTicketsPerGroup);
  };

  const handleClose = () => {
    clearResults();
    onOpenChange(false);
  };

  const getStatusIcon = (action: string) => {
    switch (action) {
      case 'bulk_analysis_completed':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'insufficient_tickets':
      case 'insufficient_unlinked_tickets':
        return <Info className="h-5 w-5 text-warning" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Análise IA de Tickets em Massa
          </DialogTitle>
          <DialogDescription>
            Analisar todos os tickets abertos da equipe <strong>{equipeNome}</strong> para identificar problemas similares
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Configurações */}
          {!results && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-create"
                  checked={autoCreateCrises}
                  onCheckedChange={setAutoCreateCrises}
                />
                <Label htmlFor="auto-create" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Criar crises automaticamente
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label htmlFor="min-tickets" className="min-w-fit">
                  Mínimo de tickets por grupo:
                </Label>
                <Input
                  id="min-tickets"
                  type="number"
                  min="2"
                  max="10"
                  value={minTicketsPerGroup}
                  onChange={(e) => setMinTicketsPerGroup(parseInt(e.target.value) || 3)}
                  className="w-20"
                />
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium text-primary mb-2">Como funciona:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Busca todos os tickets abertos da equipe (últimos 7 dias)</li>
                  <li>• Usa IA GPT para analisar semanticamente os problemas</li>
                  <li>• Agrupa tickets que falam do mesmo tipo de problema</li>
                  <li>• {autoCreateCrises ? 'Cria crises automaticamente' : 'Mostra sugestões de agrupamento'}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Botão de análise */}
          {!results && (
            <Button 
              onClick={handleAnalyze} 
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando tickets com IA...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Iniciar Análise IA
                </>
              )}
            </Button>
          )}

          {/* Resultados */}
          {results && (
            <div className="space-y-4">
              {/* Status geral */}
              <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                {getStatusIcon(results.action)}
                <div>
                  <h4 className="font-medium">
                    {results.action === 'bulk_analysis_completed' && 'Análise Concluída'}
                    {results.action === 'insufficient_tickets' && 'Tickets Insuficientes'}
                    {results.action === 'insufficient_unlinked_tickets' && 'Tickets Disponíveis Insuficientes'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {results.action === 'bulk_analysis_completed' && 
                      `${results.total_tickets_analyzed} tickets analisados, ${results.groups_found} grupos identificados`
                    }
                    {results.action === 'insufficient_tickets' && 
                      `Encontrados apenas ${(results as any).tickets_found} tickets, mínimo ${(results as any).min_required}`
                    }
                    {results.action === 'insufficient_unlinked_tickets' && 
                      `Encontrados apenas ${(results as any).unlinked_tickets} tickets não vinculados, mínimo ${(results as any).min_required}`
                    }
                  </p>
                </div>
              </div>

              {/* Grupos encontrados */}
              {results.action === 'bulk_analysis_completed' && results.results.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Grupos de Problemas Similares ({results.results.length})
                  </h4>
                  
                  <ScrollArea className="max-h-96">
                    <div className="space-y-4">
                      {results.results.map((group, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-primary">
                                {group.crise_created ? group.group : (group.suggested_title || group.group)}
                              </h5>
                              {group.reasoning && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {group.reasoning}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {group.tickets_count} tickets
                              </Badge>
                              {group.crise_created ? (
                                <Badge variant="default" className="bg-success text-success-foreground">
                                  Crise Criada
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <Eye className="h-3 w-3 mr-1" />
                                  Sugestão
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Tickets incluídos:</p>
                            <div className="flex flex-wrap gap-1">
                              {group.ticket_ids.map((ticketId) => (
                                <Badge key={ticketId} variant="outline" className="text-xs">
                                  {ticketId.slice(-8)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleClose} className="flex-1">
                  Fechar
                </Button>
                {results.action === 'bulk_analysis_completed' && !results.auto_create_crises && (
                  <Button 
                    variant="default" 
                    onClick={() => {
                      clearResults();
                      setAutoCreateCrises(true);
                    }}
                    className="flex-1"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Executar com Criação Automática
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};