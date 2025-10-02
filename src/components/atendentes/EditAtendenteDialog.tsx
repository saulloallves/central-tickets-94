import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Atendente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  tipo: 'concierge' | 'dfcom';
  status: 'ativo' | 'pausa' | 'almoco' | 'indisponivel' | 'inativo';
  horario_inicio?: string;
  horario_fim?: string;
  capacidade_maxima: number;
  capacidade_atual: number;
  foto_perfil?: string;
  observacoes?: string;
  user_id?: string;
}

interface EditAtendenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atendente: Atendente;
  onSave: (id: string, data: Partial<Atendente>) => Promise<void>;
}

export const EditAtendenteDialog = ({ open, onOpenChange, atendente, onSave }: EditAtendenteDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    tipo: 'concierge' as 'concierge' | 'dfcom',
    capacidade_maxima: 5,
    horario_inicio: '08:00',
    horario_fim: '18:00',
    observacoes: '',
  });

  useEffect(() => {
    if (atendente) {
      setFormData({
        nome: atendente.nome || '',
        email: atendente.email || '',
        telefone: atendente.telefone || '',
        tipo: atendente.tipo || 'concierge',
        capacidade_maxima: atendente.capacidade_maxima || 5,
        horario_inicio: atendente.horario_inicio || '08:00',
        horario_fim: atendente.horario_fim || '18:00',
        observacoes: atendente.observacoes || '',
      });
    }
  }, [atendente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (formData.capacidade_maxima < 1) {
      toast({
        title: "Erro",
        description: "Capacidade máxima deve ser maior que 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onSave(atendente.id, formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating atendente:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Atendente</DialogTitle>
          <DialogDescription>
            Atualize as informações do atendente
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: 'concierge' | 'dfcom') => 
                  setFormData({ ...formData, tipo: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concierge">Concierge</SelectItem>
                  <SelectItem value="dfcom">DFCom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(11) 98765-4321"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidade">Capacidade Máxima *</Label>
              <Input
                id="capacidade"
                type="number"
                min="1"
                value={formData.capacidade_maxima}
                onChange={(e) => setFormData({ ...formData, capacidade_maxima: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario_inicio">Horário Início</Label>
              <Input
                id="horario_inicio"
                type="time"
                value={formData.horario_inicio}
                onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario_fim">Horário Fim</Label>
              <Input
                id="horario_fim"
                type="time"
                value={formData.horario_fim}
                onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Notas adicionais sobre o atendente"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
