import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFranqueadoUnits } from '@/hooks/useFranqueadoUnits';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';

interface FranqueadoCreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FranqueadoCreateTicketDialog({ open, onOpenChange }: FranqueadoCreateTicketDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { units } = useFranqueadoUnits();
  const { analyzeTicket, loading: aiLoading } = useAIAnalysis();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao_problema: '',
    unidade_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !formData.titulo || !formData.descricao_problema || !formData.unidade_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create ticket with minimal data
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          codigo_ticket: '', // Will be generated automatically
          descricao_problema: formData.descricao_problema,
          titulo: formData.titulo,
          prioridade: 'posso_esperar' as any, // Default until AI analysis
          unidade_id: formData.unidade_id,
          canal_origem: 'web' as any,
          criado_por: user.id,
          status: 'aberto' as any
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar ticket:', error);
        toast({
          title: "Erro",
          description: "Falha ao criar ticket",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Ticket criado. Analisando com IA..."
      });

      // Reset form and close dialog
      setFormData({
        titulo: '',
        descricao_problema: '',
        unidade_id: ''
      });
      onOpenChange(false);

      // Analyze ticket with AI in background
      try {
        await analyzeTicket(ticket.id, formData.descricao_problema);
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        // Ticket was created successfully, AI analysis failure is not critical
        toast({
          title: "Aviso",
          description: "Ticket criado mas análise IA falhou. Será processado manualmente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar ticket",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Unidade */}
          <div className="space-y-2">
            <Label htmlFor="unidade">Unidade *</Label>
            <Select value={formData.unidade_id} onValueChange={(value) => handleInputChange('unidade_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.grupo} - {unit.cidade}/{unit.uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => handleInputChange('titulo', e.target.value)}
              placeholder="Resumo do problema"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição do Problema *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao_problema}
              onChange={(e) => handleInputChange('descricao_problema', e.target.value)}
              placeholder="Descreva detalhadamente o problema"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Categoria, prioridade e equipe responsável serão definidas automaticamente pela IA após criar o ticket.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || aiLoading}>
              {loading ? 'Criando...' : aiLoading ? 'Analisando...' : 'Criar Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}