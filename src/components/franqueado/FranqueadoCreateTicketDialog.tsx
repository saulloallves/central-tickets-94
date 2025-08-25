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

interface FranqueadoCreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FranqueadoCreateTicketDialog({ open, onOpenChange }: FranqueadoCreateTicketDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { units } = useFranqueadoUnits();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao_problema: '',
    categoria: '',
    prioridade: 'posso_esperar',
    unidade_id: '',
    canal_origem: 'web'
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
      const { error } = await supabase
        .from('tickets')
        .insert({
          codigo_ticket: '', // Será gerado automaticamente
          descricao_problema: formData.descricao_problema,
          titulo: formData.titulo,
          categoria: (formData.categoria || 'outro') as any,
          prioridade: formData.prioridade as any,
          unidade_id: formData.unidade_id,
          canal_origem: formData.canal_origem as any,
          criado_por: user.id,
          status: 'aberto' as any
        });

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
        description: "Ticket criado com sucesso"
      });

      // Reset form
      setFormData({
        titulo: '',
        descricao_problema: '',
        categoria: '',
        prioridade: 'posso_esperar',
        unidade_id: '',
        canal_origem: 'web'
      });

      onOpenChange(false);
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
          </div>

          {/* Categoria e Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={formData.categoria} onValueChange={(value) => handleInputChange('categoria', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="operacoes">Operações</SelectItem>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={(value) => handleInputChange('prioridade', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crise">Crise</SelectItem>
                  <SelectItem value="imediato">Imediato</SelectItem>
                  <SelectItem value="ate_1_hora">Até 1 hora</SelectItem>
                  <SelectItem value="ainda_hoje">Ainda hoje</SelectItem>
                  <SelectItem value="posso_esperar">Posso esperar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


          {/* Canal de Origem */}
          <div className="space-y-2">
            <Label htmlFor="canal_origem">Canal de Origem</Label>
            <Select value={formData.canal_origem} onValueChange={(value) => handleInputChange('canal_origem', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}