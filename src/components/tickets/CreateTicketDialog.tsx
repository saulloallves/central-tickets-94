import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnidadeCombobox } from './UnidadeCombobox';
import { useTickets } from '@/hooks/useTickets';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useFAQSuggestion } from '@/hooks/useFAQSuggestion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Lightbulb, MessageSquare } from 'lucide-react';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Unidade {
  id: string;
  grupo: string;
}

export const CreateTicketDialog = ({ open, onOpenChange }: CreateTicketDialogProps) => {
  const { createTicket } = useTickets({
    search: '', status: '', categoria: '', prioridade: '', unidade_id: '', status_sla: '', equipe_id: ''
  });
  const { user } = useAuth();
  const { isAdmin, isGerente } = useRole();
  const { getSuggestion, logFAQInteraction, loading: faqLoading } = useFAQSuggestion();
  const [submitting, setSubmitting] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [equipes, setEquipes] = useState<{id: string; nome: string}[]>([]);
  const [faqResponse, setFaqResponse] = useState<{
    resposta_ia_sugerida: string;
    log_prompt_faq: any;
    rag_hits?: number;
    kb_hits?: number;
  } | null>(null);
  const [showFAQStep, setShowFAQStep] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [formData, setFormData] = useState({
    unidade_id: '',
    descricao_problema: '',
    equipe_responsavel_id: '',
    prioridade: 'padrao_24h' as const,
    subcategoria: ''
  });

  // Load saved form data from localStorage when dialog opens
  useEffect(() => {
    if (open) {
      const savedData = localStorage.getItem('createTicket_formData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setFormData(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Error loading saved form data:', error);
        }
      }
    }
  }, [open]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (open && (formData.descricao_problema || formData.equipe_responsavel_id || formData.subcategoria)) {
      localStorage.setItem('createTicket_formData', JSON.stringify(formData));
    }
  }, [formData, open]);

  // Clear saved data when form is successfully submitted or dialog is closed
  const clearSavedData = () => {
    localStorage.removeItem('createTicket_formData');
    setFormData({
      unidade_id: unidades.length === 1 ? unidades[0].id : '',
      descricao_problema: '',
      equipe_responsavel_id: '',
      prioridade: 'padrao_24h',
      subcategoria: ''
    });
    setFaqResponse(null);
    setShowFAQStep(false);
    setJustificativa('');
  };

  // Fetch available units
  useEffect(() => {
    const fetchUnidades = async () => {
      try {
        let query = supabase.from('unidades').select('id, grupo');
        
        // If not admin, filter by user's units
        if (!isAdmin) {
          if (isGerente) {
            // Gerente can see their franchised units
            const { data: userData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', user?.id)
              .single();
            
            if (userData?.email) {
              const { data: franqueadoData } = await supabase
                .from('franqueados')
                .select('unit_code')
                .eq('email', userData.email)
                .single();
              
              if (franqueadoData?.unit_code) {
                const unitIds = Object.keys(franqueadoData.unit_code);
                query = query.in('id', unitIds);
              }
            }
          } else {
            // Colaborador can only see their own unit
            const { data: userData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', user?.id)
              .single();
            
            if (userData?.email) {
              const { data: colaboradorData } = await supabase
                .from('colaboradores')
                .select('unidade_id')
                .eq('email', userData.email)
                .single();
              
              if (colaboradorData?.unidade_id) {
                query = query.eq('id', colaboradorData.unidade_id);
              }
            }
          }
        }

        const { data, error } = await query;
        if (error) {
          console.error('Error fetching unidades:', error);
          return;
        }

        setUnidades(data || []);
        
        // Auto-select if only one unit available
        if (data && data.length === 1) {
          setFormData(prev => ({ ...prev, unidade_id: data[0].id }));
        }
      } catch (error) {
        console.error('Error fetching unidades:', error);
      }
    };

    if (open) {
      fetchUnidades();
      fetchEquipes();
    }
  }, [open, isAdmin, isGerente, user?.id]);

  // Fetch available teams
  const fetchEquipes = async () => {
    try {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        console.error('Error fetching equipes:', error);
        return;
      }

      setEquipes(data || []);
    } catch (error) {
      console.error('Error fetching equipes:', error);
    }
  };

  const handleGetSuggestion = async () => {
    if (formData.descricao_problema.trim().length < 10) {
      alert('Por favor, descreva o problema com pelo menos 10 caracteres para obter uma sugestão');
      return;
    }

    const suggestion = await getSuggestion(formData.descricao_problema);
    if (suggestion) {
      setFaqResponse(suggestion);
      setShowFAQStep(true);
    }
  };

  const handleUseSuggestion = async () => {
    if (faqResponse) {
      await logFAQInteraction(
        formData.descricao_problema,
        faqResponse.resposta_ia_sugerida,
        faqResponse.log_prompt_faq,
        true
      );
      
      // Clear saved data and reset form
      clearSavedData();
      onOpenChange(false);
    }
  };

  const handleOpenTicketAnyway = async () => {
    if (!justificativa.trim()) {
      alert('Por favor, informe por que deseja abrir o ticket mesmo após a sugestão');
      return;
    }

    // Log the interaction showing user chose to open ticket
    if (faqResponse) {
      await logFAQInteraction(
        formData.descricao_problema,
        faqResponse.resposta_ia_sugerida,
        faqResponse.log_prompt_faq,
        false,
        justificativa
      );
    }

    // Proceed with ticket creation
    handleSubmit();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validações
    if (!formData.unidade_id) {
      alert('Por favor, selecione uma unidade');
      return;
    }
    
    if (!formData.descricao_problema.trim()) {
      alert('Por favor, descreva o problema');
      return;
    }

    if (formData.descricao_problema.trim().length < 10) {
      alert('A descrição deve ter pelo menos 10 caracteres');
      return;
    }

    // Check if we should show FAQ suggestion first
    if (!showFAQStep && !faqResponse) {
      handleGetSuggestion();
      return;
    }

    setSubmitting(true);
    try {
      console.log('Submitting ticket with data:', formData);
      
      const ticket = await createTicket({
        unidade_id: formData.unidade_id,
        descricao_problema: formData.descricao_problema.trim(),
        equipe_responsavel_id: formData.equipe_responsavel_id || undefined,
        prioridade: formData.prioridade,
        subcategoria: formData.subcategoria?.trim() || undefined
      });

      if (ticket) {
        console.log('Ticket created successfully:', ticket);
        
        // If we have FAQ response, log it with the ticket ID
        if (faqResponse) {
          await logFAQInteraction(
            formData.descricao_problema,
            faqResponse.resposta_ia_sugerida,
            faqResponse.log_prompt_faq,
            false,
            justificativa,
            ticket.id
          );
        }
        
        // Clear saved data and reset form
        clearSavedData();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showFAQStep ? 'Sugestão da IA' : 'Criar Novo Ticket'}
          </DialogTitle>
        </DialogHeader>

        {showFAQStep && faqResponse ? (
          // FAQ Suggestion Step
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Encontramos uma possível solução!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Sua pergunta:</h4>
                    <p className="text-sm bg-muted p-3 rounded-md">{formData.descricao_problema}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      Sugestão da IA:
                      {(faqResponse.rag_hits || 0) + (faqResponse.kb_hits || 0) > 0 && (
                        <span className="ml-2 text-xs text-primary">
                          ({(faqResponse.rag_hits || 0) + (faqResponse.kb_hits || 0)} docs consultados)
                        </span>
                      )}
                    </h4>
                    <div className="text-sm bg-primary/5 p-3 rounded-md border border-primary/20">
                      {faqResponse.resposta_ia_sugerida.split('\n').map((line, index) => (
                        <p key={index} className="mb-2 last:mb-0">{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={handleUseSuggestion}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Problema Resolvido
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFAQStep(false)}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Ainda Preciso de Ajuda
                </Button>
              </div>

              {!showFAQStep && (
                <div>
                  <Label htmlFor="justificativa">Por que ainda precisa abrir o ticket?</Label>
                  <Textarea
                    id="justificativa"
                    placeholder="Ex: A sugestão não resolve meu caso específico, preciso de mais detalhes..."
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {!showFAQStep && (
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowFAQStep(true);
                    setJustificativa('');
                  }}
                >
                  Voltar
                </Button>
                <Button 
                  onClick={handleOpenTicketAnyway}
                  disabled={!justificativa.trim() || submitting}
                >
                  {submitting ? 'Criando...' : 'Abrir Ticket'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Normal Form Step
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="unidade">Unidade *</Label>
              <UnidadeCombobox
                unidades={unidades}
                value={formData.unidade_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unidade_id: value }))}
                placeholder="Selecione uma unidade..."
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição do Problema *</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva detalhadamente o problema..."
                value={formData.descricao_problema}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao_problema: e.target.value }))}
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="equipe">Equipe Responsável</Label>
                <Select 
                  value={formData.equipe_responsavel_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, equipe_responsavel_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipe..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma equipe específica</SelectItem>
                    {equipes.map((equipe) => (
                      <SelectItem key={equipe.id} value={equipe.id}>
                        {equipe.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select 
                  value={formData.prioridade} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, prioridade: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crise">Crise</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="hoje_18h">Hoje até 18h</SelectItem>
                    <SelectItem value="padrao_24h">Padrão (24h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="subcategoria">Subcategoria</Label>
              <Input
                id="subcategoria"
                placeholder="Ex: Bug no sistema, Dúvida sobre processo..."
                value={formData.subcategoria}
                onChange={(e) => setFormData(prev => ({ ...prev, subcategoria: e.target.value }))}
              />
            </div>

            {faqResponse && (
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Justificativa para Abertura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Informe por que ainda precisa abrir o ticket após a sugestão da IA..."
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={3}
                    required
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={!formData.unidade_id || !formData.descricao_problema.trim() || faqLoading || submitting || (faqResponse && !justificativa.trim())}
              >
                {faqLoading ? 'Consultando IA...' : submitting ? 'Criando...' : faqResponse ? 'Criar Ticket' : 'Consultar IA'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};