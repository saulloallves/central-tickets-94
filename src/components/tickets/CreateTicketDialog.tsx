import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTickets } from '@/hooks/useTickets';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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
    search: '', status: '', categoria: '', prioridade: '', unidade_id: '', status_sla: ''
  });
  const { user } = useAuth();
  const { isAdmin, isGerente } = useRole();
  const [submitting, setSubmitting] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [formData, setFormData] = useState({
    unidade_id: '',
    descricao_problema: '',
    categoria: '',
    prioridade: 'padrao_24h' as const,
    subcategoria: ''
  });

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
    }
  }, [open, isAdmin, isGerente, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    setSubmitting(true);
    try {
      console.log('Submitting ticket with data:', formData);
      
      const ticket = await createTicket({
        unidade_id: formData.unidade_id,
        descricao_problema: formData.descricao_problema.trim(),
        categoria: (formData.categoria as any) || undefined,
        prioridade: formData.prioridade,
        subcategoria: formData.subcategoria?.trim() || undefined
      });

      if (ticket) {
        console.log('Ticket created successfully:', ticket);
        // Reset form
        setFormData({
          unidade_id: unidades.length === 1 ? unidades[0].id : '',
          descricao_problema: '',
          categoria: '',
          prioridade: 'padrao_24h',
          subcategoria: ''
        });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="unidade">Unidade *</Label>
            <Select 
              value={formData.unidade_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, unidade_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((unidade) => (
                  <SelectItem key={unidade.id} value={unidade.id}>
                    {unidade.grupo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="categoria">Categoria</Label>
              <Select 
                value={formData.categoria} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="midia">Mídia</SelectItem>
                  <SelectItem value="operacoes">Operações</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
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
              disabled={!formData.unidade_id || !formData.descricao_problema.trim() || submitting}
            >
              {submitting ? 'Criando...' : 'Criar Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};